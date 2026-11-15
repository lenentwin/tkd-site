<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

final class Permissions
{
    public const ALL=['applications.decide','students.status','payments.write','students.archive','students.restore'];
    public static function effective(string $role,array $overrides=[]): array {
        if($role==='admin'){return self::ALL;}
        if(!in_array($role,['trainer','head_trainer'],true)){return [];}
        $result=$role==='head_trainer'?self::ALL:array_slice(self::ALL,0,3);
        foreach(self::ALL as $permission){
            if(!array_key_exists($permission,$overrides)){continue;}
            $result=array_values(array_diff($result,[$permission]));
            if($overrides[$permission]===true){$result[]=$permission;}
        }
        return array_values(array_intersect(self::ALL,$result));
    }
    public static function assigned(array $actor): bool {
        return $actor['role']==='trainer'||($actor['role']==='head_trainer'&&($actor['hallScope']??'all')==='assigned');
    }
    public static function require(array $actor,string $permission): void {
        if(!in_array($permission,$actor['permissions']??[],true)){throw new ApiError(403,'forbidden');}
    }
    public static function admin(array $actor): void {
        if($actor['role']!=='admin'){throw new ApiError(403,'forbidden');}
    }
}
