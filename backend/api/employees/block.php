<?php
// POST /api/employees/block.php { name }
require_once __DIR__ . '/../../includes/api_helpers.php';
$admin_username = require_login();

$data = json_input();
$name = trim($data['name'] ?? '');
if ($name === '') json_error('No name parameter provided.');

$check = $conn->prepare('SELECT block FROM employees WHERE name = ?');
$check->bind_param('s', $name);
$check->execute();
$result = $check->get_result();
if ($result->num_rows === 0) { $check->close(); json_error("❌ No employee found with the name '$name'."); }

$row = $result->fetch_assoc();
$check->close();
if ($row['block'] === 'block') json_error("⚠️ '$name' is already blocked.");

$block = 'block';
$update = $conn->prepare('UPDATE employees SET block = ? WHERE name = ?');
$update->bind_param('ss', $block, $name);
if (!$update->execute()) json_error('Update error: ' . $update->error, 500);
$update->close();

log_action($conn, $admin_username, 'Blocked medrep customer', "Blocked medrep customer: $name");
json_success(['message' => "✅ '$name' has been blocked successfully."]);
