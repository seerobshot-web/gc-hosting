CREATE SCHEMA glinks;

-- Identity mapping only. Credentials and sessions belong to the auth provider.
CREATE TABLE glinks.users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_provider text NOT NULL,
    auth_subject text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (auth_provider, auth_subject)
);
CREATE TABLE glinks.workspaces (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE glinks.memberships (
    workspace_id bigint NOT NULL REFERENCES glinks.workspaces(id),
    user_id bigint NOT NULL REFERENCES glinks.users(id),
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    PRIMARY KEY (workspace_id, user_id)
);

-- Serialize membership changes with publication/ownership operations.
CREATE FUNCTION glinks.lock_membership_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id) THEN
        RAISE EXCEPTION 'Membership identity is immutable';
    END IF;
    PERFORM id FROM glinks.workspaces
        WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.workspace_id ELSE NEW.workspace_id END
        FOR UPDATE;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER membership_lock BEFORE INSERT OR UPDATE OR DELETE ON glinks.memberships
    FOR EACH ROW EXECUTE FUNCTION glinks.lock_membership_workspace();

CREATE FUNCTION glinks.require_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target bigint;
BEGIN
    IF TG_TABLE_NAME = 'workspaces' THEN target := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN target := OLD.workspace_id;
    ELSE target := NEW.workspace_id;
    END IF;
    IF EXISTS (SELECT 1 FROM glinks.workspaces WHERE id = target)
        AND NOT EXISTS (SELECT 1 FROM glinks.memberships WHERE workspace_id = target AND role = 'owner') THEN
        RAISE EXCEPTION 'A workspace must retain an owner' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER workspace_owner AFTER INSERT ON glinks.workspaces
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION glinks.require_owner();
CREATE CONSTRAINT TRIGGER membership_owner AFTER INSERT OR UPDATE OR DELETE ON glinks.memberships
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION glinks.require_owner();

CREATE TABLE glinks.pages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL REFERENCES glinks.workspaces(id),
    handle text NOT NULL UNIQUE CHECK (
        handle ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
        AND handle NOT IN ('admin','api','go','stats','health','login','register','www','support')
    ),
    draft jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(draft) = 'object'),
    published_publication_id bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, id)
);
CREATE TABLE glinks.links (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    slug text NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
    url text NOT NULL CHECK (url ~* '^https?://' AND length(url) <= 2048),
    emoji text,
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    enabled boolean NOT NULL DEFAULT true,
    deleted_at timestamptz,
    FOREIGN KEY (workspace_id, page_id) REFERENCES glinks.pages(workspace_id, id),
    UNIQUE (workspace_id, page_id, id),
    UNIQUE (workspace_id, page_id, slug)
);
-- Soft deletion intentionally does not free a link slug or delete its history.
CREATE TABLE glinks.publications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (workspace_id, page_id) REFERENCES glinks.pages(workspace_id, id),
    UNIQUE (workspace_id, page_id, id)
);
ALTER TABLE glinks.pages ADD CONSTRAINT published_page_owner
    FOREIGN KEY (workspace_id, id, published_publication_id)
    REFERENCES glinks.publications(workspace_id, page_id, id);
CREATE FUNCTION glinks.reject_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Published snapshots are immutable';
END $$;
CREATE TRIGGER immutable_publication BEFORE UPDATE ON glinks.publications
    FOR EACH ROW EXECUTE FUNCTION glinks.reject_snapshot_update();

CREATE TABLE glinks.click_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    link_id bigint NOT NULL,
    publication_id bigint NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    referrer_host text CHECK (length(referrer_host) <= 253),
    FOREIGN KEY (workspace_id, page_id, link_id)
        REFERENCES glinks.links(workspace_id, page_id, id),
    FOREIGN KEY (workspace_id, page_id, publication_id)
        REFERENCES glinks.publications(workspace_id, page_id, id)
);
CREATE INDEX clicks_workspace_time ON glinks.click_events(workspace_id, occurred_at);
CREATE INDEX clicks_link_time ON glinks.click_events(workspace_id, page_id, link_id, occurred_at);

-- Structural contracts for later media and custom-domain slices, not enabled routes.
CREATE TABLE glinks.media_assets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL REFERENCES glinks.workspaces(id),
    storage_key text NOT NULL UNIQUE,
    kind text NOT NULL CHECK (kind IN ('avatar','image','video','caption','og')),
    state text NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending','processing','ready','failed','deleted')),
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, id)
);
CREATE TABLE glinks.modules (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    kind text NOT NULL CHECK (kind IN ('links','video','gallery','events','devotional','testimonials','giving')),
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    content jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(content) = 'object'),
    FOREIGN KEY (workspace_id, page_id) REFERENCES glinks.pages(workspace_id, id),
    UNIQUE (workspace_id, page_id, id)
);
CREATE TABLE glinks.module_media (
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    module_id bigint NOT NULL,
    asset_id bigint NOT NULL,
    PRIMARY KEY (workspace_id, page_id, module_id, asset_id),
    FOREIGN KEY (workspace_id, page_id, module_id)
        REFERENCES glinks.modules(workspace_id, page_id, id),
    FOREIGN KEY (workspace_id, asset_id) REFERENCES glinks.media_assets(workspace_id, id)
);
CREATE TABLE glinks.domains (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id bigint NOT NULL,
    page_id bigint NOT NULL,
    hostname text NOT NULL UNIQUE CHECK (hostname = lower(hostname)),
    state text NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending','verified','active','failed','removed')),
    verified_at timestamptz,
    FOREIGN KEY (workspace_id, page_id) REFERENCES glinks.pages(workspace_id, id),
    CHECK (state NOT IN ('verified','active') OR verified_at IS NOT NULL)
);
