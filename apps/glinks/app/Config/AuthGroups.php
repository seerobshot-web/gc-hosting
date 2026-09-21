<?php
namespace Config;
class AuthGroups extends \CodeIgniter\Shield\Config\AuthGroups
{
    public string $defaultGroup = 'user';
    public array $groups = ['user'=>['title'=>'User','description'=>'GLINKS account']];
    public array $permissions = [];
    public array $matrix = [];
}
