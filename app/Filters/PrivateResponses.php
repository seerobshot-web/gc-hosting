<?php
namespace App\Filters;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Defaults every response to private/no-store, since this app is
 * overwhelmingly a session-authenticated admin surface. The public page
 * renderer is the one deliberate exception: it marks its response with
 * X-Glinks-Public before returning, so this filter leaves its own
 * (public, cacheable) Cache-Control and Referrer-Policy alone instead of
 * overwriting them. Required filters run on every route with no per-route
 * exclusion mechanism, which is exactly why this needs an explicit,
 * narrow opt-out rather than route-pattern matching.
 */
final class PrivateResponses implements FilterInterface
{
    public function before(RequestInterface $request,$arguments=null) {}
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null)
    {
        if ($response->hasHeader('X-Glinks-Public')) {
            $response->removeHeader('X-Glinks-Public');
            return;
        }
        $response->setHeader('Referrer-Policy','no-referrer');
        $response->removeHeader('Cache-Control')->setHeader('Cache-Control','private, no-store');
    }
}
