<?php
declare(strict_types=1);
require __DIR__ . '/mysql-bootstrap.php';
if (($argv[1] ?? '') === 'register') { echo $store->upsertUser('999990001')['id']; }
else {
    try { $store->consumeState(hash('sha256', 'test-session'), 'test-state', time()); echo 'claimed'; }
    catch (\Mft39\ApiError) { echo 'rejected'; }
}
