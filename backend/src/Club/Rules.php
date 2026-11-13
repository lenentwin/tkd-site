<?php
declare(strict_types=1);
namespace Mft39\Club;
use Mft39\ApiError;

final class Rules
{
    public const CONSENT_VERSION='club-2026-11-13';
    public static function month(int $now): string { return (new \DateTimeImmutable('@'.$now))->setTimezone(new \DateTimeZone('Europe/Kaliningrad'))->format('Y-m'); }
    public static function utc(int $now): string { return gmdate('Y-m-d H:i:s',$now); }
    public static function iso(string $utc): string { return str_replace(' ','T',$utc).'Z'; }
    public static function day(int $now): string { return (new \DateTimeImmutable('@'.$now))->setTimezone(new \DateTimeZone('Europe/Kaliningrad'))->format('Y-m-d'); }
    public static function paragraph(mixed $value): string {
        if(!is_string($value)||!preg_match('//u',$value)||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u',$value)||preg_match_all('/./us',$value)>1000){throw new ApiError(422,'invalid_comment');}
        return trim(str_replace(["\r\n","\r"],"\n",$value));
    }
    public static function uuid(): string { $b=random_bytes(16);$b[6]=chr((ord($b[6])&15)|64);$b[8]=chr((ord($b[8])&63)|128);$h=bin2hex($b);return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20); }
    public static function text(mixed $value,int $max,bool $required=true): string {
        if(!is_string($value)||!preg_match('//u',$value)||preg_match('/[\x00-\x1f\x7f]/u',$value)||preg_match_all('/./us',$value)>$max){throw new ApiError(422,'invalid_fields');}
        $value=preg_replace('/\s+/u',' ',trim($value));if($required&&$value===''){throw new ApiError(422,'invalid_fields');}return $value;
    }
    public static function name(mixed $value,bool $required=true): string {
        $v=self::text($value,80,$required);if($v!==''&&(!preg_match('/^[\p{L}\p{M} .’\'-]+$/uD',$v)||!preg_match('/\p{L}/u',$v))){throw new ApiError(422,'invalid_fields');}return $v;
    }
    public static function id(mixed $value): string { if(!is_string($value)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$value)){throw new ApiError(422,'invalid_id');}return $value; }
    public static function version(mixed $value): int { if(!is_int($value)||$value<0||$value>2147483646){throw new ApiError(422,'version_required');}return $value; }
    public static function choice(mixed $v,array $choices): string { if(!is_string($v)||!in_array($v,$choices,true)){throw new ApiError(422,'invalid_fields');}return $v; }
    public static function input(array $v,int $now): array {
        if(($v['consent']??null)!==true||($v['consentVersion']??null)!==self::CONSENT_VERSION){throw new ApiError(422,'consent_required');}
        if(!isset($v['students'])||!is_array($v['students'])||!array_is_list($v['students'])||count($v['students'])<1||count($v['students'])>20){throw new ApiError(422,'invalid_students');}
        $students=[];foreach($v['students'] as $s){
            if(!is_array($s)||!is_int($s['age']??null)||$s['age']<1||$s['age']>120){throw new ApiError(422,'invalid_age');}
            $students[]=['id'=>isset($s['id'])?self::id($s['id']):null,'lastName'=>self::name($s['lastName']??null),'firstName'=>self::name($s['firstName']??null),'middleName'=>self::name($s['middleName']??'',false),'age'=>$s['age']];
        }
        $hall=self::text($v['locationId']??null,64);if(!preg_match('/^[a-zA-Z0-9_-]+$/D',$hall)){throw new ApiError(422,'invalid_hall');}
        $date=$v['requestedDate']??null;$parsed=is_string($date)?\DateTimeImmutable::createFromFormat('!Y-m-d',$date,new \DateTimeZone('Europe/Kaliningrad')):false;
        $today=(new \DateTimeImmutable('@'.$now))->setTimezone(new \DateTimeZone('Europe/Kaliningrad'))->format('Y-m-d');
        if(!$parsed||$parsed->format('Y-m-d')!==$date||$date<$today){throw new ApiError(422,'invalid_date');}
        $guardian=null;if(array_filter($students,fn($s)=>$s['age']<18)){
            $g=$v['guardian']??null;if(!is_array($g)){throw new ApiError(422,'guardian_required');}
            $phone=self::text($g['phone']??null,24);if(!preg_match('/^[+0-9 ()-]+$/D',$phone)||!preg_match('/^[0-9]{10,15}$/D',preg_replace('/\D/','',$phone))){throw new ApiError(422,'invalid_phone');}
            $guardian=['lastName'=>self::name($g['lastName']??null),'firstName'=>self::name($g['firstName']??null),'middleName'=>self::name($g['middleName']??'',false),'phone'=>$phone,'relationship'=>self::choice($g['relationship']??null,['parent','guardian'])];
        }
        return ['students'=>$students,'locationId'=>$hall,'requestedDate'=>$date,'guardian'=>$guardian,'comment'=>self::paragraph($v['comment']??''),'consent'=>true,'consentVersion'=>self::CONSENT_VERSION];
    }
}
