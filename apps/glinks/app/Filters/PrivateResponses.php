<?php
namespace App\Filters;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
final class PrivateResponses implements FilterInterface
{
    public function before(RequestInterface $request,$arguments=null) {}
    public function after(RequestInterface $request,ResponseInterface $response,$arguments=null)
    {
        $response->setHeader('Referrer-Policy','no-referrer');
        $response->removeHeader('Cache-Control')->setHeader('Cache-Control','private, no-store');
    }
}
