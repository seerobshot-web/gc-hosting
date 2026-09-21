\set ON_ERROR_STOP on
BEGIN;
\ir ../app/Database/Sql/001_foundation.sql
INSERT INTO glinks.users(auth_provider, auth_subject) VALUES ('test','alice'), ('test','bob');
INSERT INTO glinks.workspaces(name) VALUES ('Ministry A'), ('Ministry B');
INSERT INTO glinks.memberships VALUES (1,1,'owner'), (2,2,'owner');
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO glinks.pages(workspace_id, handle) VALUES (1,'ministry-a'), (2,'ministry-b');
INSERT INTO glinks.links(workspace_id, page_id, slug, title, url)
    VALUES (1,1,'give','Give','https://example.org');
DO $$
BEGIN
    BEGIN
        INSERT INTO glinks.links(workspace_id,page_id,slug,title,url)
            VALUES (1,2,'bad','Bad','https://example.org');
        RAISE EXCEPTION 'Cross-tenant link accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE glinks.memberships SET role = 'viewer' WHERE workspace_id = 1;
        RAISE EXCEPTION 'Last owner demotion accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM glinks.memberships WHERE workspace_id = 2;
        RAISE EXCEPTION 'Last owner deletion accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
INSERT INTO glinks.publications(workspace_id,page_id,snapshot) VALUES (1,1,'{}'),(2,2,'{}');
UPDATE glinks.pages SET published_publication_id = 1 WHERE id = 1;
DO $$
BEGIN
    BEGIN
        UPDATE glinks.pages SET published_publication_id = 2 WHERE id = 1;
        RAISE EXCEPTION 'Cross-tenant publication accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE glinks.publications SET snapshot = '{"changed":true}' WHERE id = 1;
        RAISE EXCEPTION 'Mutable snapshot accepted' USING ERRCODE = '23514';
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
END $$;
INSERT INTO glinks.media_assets(workspace_id,storage_key,kind,size_bytes) VALUES (2,'2/video/1','video',10);
INSERT INTO glinks.modules(workspace_id,page_id,kind) VALUES (1,1,'video');
DO $$
BEGIN
    BEGIN
        INSERT INTO glinks.module_media VALUES (1,1,1,1);
        RAISE EXCEPTION 'Cross-tenant media accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END $$;
ROLLBACK;
\echo PASS: tenant foreign keys, immutable publications, media ownership, last-owner protection
