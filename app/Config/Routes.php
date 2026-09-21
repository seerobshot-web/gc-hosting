<?php
use CodeIgniter\Router\RouteCollection;
/** @var RouteCollection $routes */
$routes->setAutoRoute(false);
$routes->get('health/live','Health::live');
$routes->get('health/ready','Health::ready');

// Public surface: reachable regardless of enableTenantRoutes, since
// visitors need no tenant/admin access at all. `go` is one of the
// handles glinks.pages.handle's CHECK constraint reserves (see
// 001_foundation.sql), so it can never collide with a real page.
$routes->get('go/(:segment)/(:segment)','PublicPages::visit/$1/$2');

if (config('Glinks')->enableTenantRoutes) {
    service('auth')->routes($routes, ['except'=>['logout','magic-link']]);
    $routes->post('logout','\\CodeIgniter\\Shield\\Controllers\\LoginController::logoutAction',['as'=>'logout','filter'=>'session']);
    $routes->get('/','Workspaces::index',['filter'=>'session']);
    $routes->group('workspaces',['filter'=>'session'],static function($routes) {
        $routes->get('/','Workspaces::index');
        $routes->post('/','Workspaces::create');
        $routes->get('(:num)/pages/(:num)','Workspaces::page/$1/$2');
        $routes->post('(:num)/pages/(:num)/publish','Workspaces::publish/$1/$2');
    });

    $routes->get('recover','Recovery::form');
    $routes->post('recover','Recovery::requestLink');
    $routes->get('recover/reset','Recovery::resetForm');
    $routes->post('recover/reset','Recovery::resetPassword');
    $routes->get('invitations/accept','Invitations::acceptForm',['filter'=>'session']);
    $routes->post('invitations/accept','Invitations::accept',['filter'=>'session']);
    $routes->get('workspaces/(:num)/invitations','Invitations::index/$1',['filter'=>'session']);
    $routes->post('workspaces/(:num)/invitations','Invitations::create/$1',['filter'=>'session']);
    $routes->post('workspaces/(:num)/invitations/(:num)/revoke','Invitations::revoke/$1/$2',['filter'=>'session']);

    $routes->get('workspaces/(:num)/pages','Pages::index/$1',['filter'=>'session']);
    $routes->post('workspaces/(:num)/pages','Pages::create/$1',['filter'=>'session']);
    $routes->get('workspaces/(:num)/pages/(:num)/edit','Pages::edit/$1/$2',['filter'=>'session']);
    $routes->post('workspaces/(:num)/pages/(:num)/edit','Pages::save/$1/$2',['filter'=>'session']);
}

// Catch-all page view, registered last so it never shadows a route above -
// every one of those (login, register, workspaces, recover, invitations,
// health, go, ...) is also a handle the pages table's CHECK constraint
// reserves, so a real page can never collide with them either way.
$routes->get('(:segment)','PublicPages::show/$1');
