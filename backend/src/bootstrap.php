<?php
declare(strict_types=1);
// No dependency manager or code downloaded at server startup.
foreach (['Config', 'Http', 'Yandex', 'Store', 'App'] as $module) { require_once __DIR__ . '/' . $module . '.php'; }
foreach (['Rules','Repository','Gate','Controller'] as $module) { require_once __DIR__.'/Club/'.$module.'.php'; }
