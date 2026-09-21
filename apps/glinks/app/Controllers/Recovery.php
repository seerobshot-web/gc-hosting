<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Libraries\GlinksDatabase;
use App\Libraries\RecoveryTokens;
use App\Domain\Tenancy\ResourceUnavailable;
final class Recovery extends BaseController
{
    public function form() { return view('auth/recover'); }
    public function requestLink()
    {
        $email=$this->request->getPost('email');
        if (!is_string($email) || strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)) {
            return $this->response->setStatusCode(422)->setBody(view('auth/recover',['error'=>'Enter a valid email address.']));
        }
        $service=new RecoveryTokens(GlinksDatabase::connect());
        $token=$service->issue($email);
        if ($token !== null) {
            try {
                helper('email');
                $mail=emailer(['mailType'=>'text'])->setFrom(setting('Email.fromEmail'),setting('Email.fromName'))
                    ->setTo($email)->setSubject('Recover your GLINKS account')
                    ->setMessage("Choose a new password within 30 minutes:\n".site_url('recover/reset').'?token='.$token."\nIf you did not request this, ignore this message.");
                if (!$mail->send()) { throw new \RuntimeException('Delivery failed'); }
            } catch (\Throwable) {
                // Never expose account existence, SMTP details, or bearer tokens.
                log_message('error','GLINKS recovery delivery failed');
            }
        }
        return view('auth/recover',['sent'=>true]);
    }
    public function resetForm()
    {
        $token=$this->request->getGet('token');
        return view('auth/reset',['token'=>is_string($token)?$token:'']);
    }
    public function resetPassword()
    {
        $token=$this->request->getPost('token');
        $password=$this->request->getPost('password');
        if (!is_string($token) || !is_string($password) || $password!==$this->request->getPost('password_confirm')) {
            return $this->response->setStatusCode(422)->setBody('Invalid recovery request.');
        }
        try {
            (new RecoveryTokens(GlinksDatabase::connect()))->reset($token,$password);
        } catch (ResourceUnavailable|\InvalidArgumentException) {
            return $this->response->setStatusCode(422)->setBody(view('auth/reset',['token'=>$token,'error'=>'The link is invalid or expired, or the password does not meet requirements.']));
        }
        auth()->logout();
        session()->remove('glinks_credential');
        return redirect()->to(site_url('login'))->with('message','Password changed. Sign in with your new password.');
    }
}
