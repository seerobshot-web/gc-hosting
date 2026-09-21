<?php
use CodeIgniter\Router\RouteCollection;
/** @var RouteCollection $routes */
$routes->setAutoRoute(false);
$routes->get('health/live','Health::live');
$routes->get('health/ready','Health::ready');
if (!config('Glinks')->enableTenantRoutes) { return; }
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
