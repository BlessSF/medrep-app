<?php
// POST /api/employees/edit.php { original_name, edit_name, edit_company }
require_once __DIR__ . '/../../includes/api_helpers.php';
$admin_username = require_login();

$data = json_input();
$original_name = trim($data['original_name'] ?? '');
$edit_name = trim($data['edit_name'] ?? '');
$edit_company = trim($data['edit_company'] ?? '');

if ($original_name === '' || $edit_name === '' || $edit_company === '') {
    json_error('Please fill in all required fields.');
}

$result = $conn->prepare('SELECT name, company FROM employees WHERE name = ?');
$result->bind_param('s', $original_name);
$result->execute();
$result->bind_result($orig_name_db, $orig_company_db);
$result->fetch();
$result->close();

$stmt = $conn->prepare('UPDATE employees SET name = ?, company = ? WHERE name = ?');
$stmt->bind_param('sss', $edit_name, $edit_company, $original_name);

if (!$stmt->execute()) {
    json_error('Error updating record: ' . $stmt->error, 500);
}
$stmt->close();

if ($edit_name !== $orig_name_db && $edit_company !== $orig_company_db) {
    $details = "Updated '{$orig_name_db}' from '{$orig_company_db}' to new name '{$edit_name}' under company '{$edit_company}'";
} elseif ($edit_name !== $orig_name_db) {
    $details = "Updated name from '{$orig_name_db}' to '{$edit_name}' under company '{$edit_company}'";
} elseif ($edit_company !== $orig_company_db) {
    $details = "Updated '{$edit_name}' company from '{$orig_company_db}' to '{$edit_company}'";
} else {
    $details = '';
}
if ($details !== '') {
    log_action($conn, $admin_username, 'Updated Medrep Information', $details);
}

json_success(['message' => 'Customer updated successfully.', 'name' => $edit_name, 'company' => $edit_company, 'original_name' => $original_name]);
