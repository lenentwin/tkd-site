<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/bootstrap.php';
use Mft39\Club\Legal;
$documents=json_decode(file_get_contents(dirname(__DIR__).'/resources/legal-documents.json'),true,32,JSON_THROW_ON_ERROR);
Legal::validateDocuments($documents);
function rejected(array $documents):void {try{Legal::validateDocuments($documents);}catch(RuntimeException){return;}throw new RuntimeException('Invalid document bundle accepted');}
$bad=$documents;$bad[0]['hash']=str_repeat('0',64);rejected($bad);
$bad=$documents;array_pop($bad);rejected($bad);
$bad=$documents;$bad[0]['type']='unknown';rejected($bad);
$bad=$documents;$bad[1]=$bad[0];rejected($bad);
foreach(['[УТВЕРДИТЬ СРОК]','Предполагаемый оператор','До утверждения проверить','Оператор должен проверить'] as $note){$bad=$documents;$bad[0]['status']='approved';$bad[0]['version']='final-1';$bad[0]['content']="# Test\n".$note;$bad[0]['hash']=hash('sha256',$bad[0]['content']);rejected($bad);}
echo "PASS legal bundle exact hashes, complete types and no unresolved approved documents\n";
