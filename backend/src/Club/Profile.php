<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

final class Profile
{
    public static function fullName(array $user): string {
        $name=trim(implode(' ',array_filter([$user['last_name']??'',$user['first_name']??'',$user['middle_name']??''],fn($v)=>$v!=='')));
        return $name!==''?$name:($user['display_name']??'Участник MFT39');
    }
    public static function dto(array $user): array {
        return ['firstName'=>$user['first_name']??'','lastName'=>$user['last_name']??'','middleName'=>$user['middle_name']??'',
            'displayName'=>self::fullName($user),'version'=>(int)($user['version']??1)];
    }
    public static function initialize(Repository $repo,int $id,array $info,int $now): void {
        $names=[];
        foreach(['first_name','last_name'] as $key){
            try{$names[$key]=Rules::name($info[$key]??'',false);}catch(ApiError){$names[$key]='';}
        }
        try{$display=Rules::text($info['display_name']??$info['real_name']??'Участник MFT39',250,false);}catch(ApiError){$display='Участник MFT39';}
        // Never overwrite the parent's edits on a later OAuth login. No avatar,
        // email, birthday, OAuth token or provider response is persisted.
        $repo->q('UPDATE users SET first_name=?,last_name=?,display_name=?,profile_initialized_at=?,version=version+1 WHERE id=? AND profile_initialized_at IS NULL AND profile_edited_at IS NULL',[
            $names['first_name'],$names['last_name'],$display!==''?$display:'Участник MFT39',Rules::utc($now),$id]);
    }
    public static function read(Repository $repo,array $actor): array {
        $user=$repo->q('SELECT * FROM users WHERE id=?',[$actor['id']])->fetch();
        if(!$user){throw new ApiError(404,'not_found');}return ['profile'=>self::dto($user)];
    }
    public static function save(Repository $repo,array $actor,array $data,int $now): array {
        if(array_diff(array_keys($data),['firstName','lastName','middleName','expectedVersion'])){throw new ApiError(422,'invalid_fields');}
        $first=Rules::name($data['firstName']??null);$last=Rules::name($data['lastName']??null);$middle=Rules::name($data['middleName']??'',false);$version=Rules::version($data['expectedVersion']??null);
        return $repo->transaction($actor,function()use($repo,$actor,$first,$last,$middle,$version,$now){
            $user=$repo->q('SELECT * FROM users WHERE id=? FOR UPDATE',[$actor['id']])->fetch();
            if((int)$user['version']!==$version){throw new ApiError(409,'version_conflict');}
            $repo->q('UPDATE users SET first_name=?,last_name=?,middle_name=?,display_name=?,profile_edited_at=?,updated_at=?,version=version+1 WHERE id=?',[$first,$last,$middle,trim("$last $first $middle"),Rules::utc($now),Rules::utc($now),$actor['id']]);
            $repo->audit($actor,null,null,'profile.updated',(string)$actor['id'],['fields'=>['firstName','lastName','middleName']],$now);
            return self::read($repo,$actor);
        });
    }
}
