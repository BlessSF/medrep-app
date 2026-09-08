<?php
require_once __DIR__ . '/../../includes/api_helpers.php';

$data = json_input();
$username = strtolower(trim($data['username'] ?? ''));
$password = trim($data['password'] ?? '');

if ($username === '' || $password === '') {
    json_error('Username and password are required.');
}

$stmt = $conn->prepare("SELECT username, password, role FROM users WHERE LOWER(username) = ?");
$stmt->bind_param('s', $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    json_error('User not found.', 401);
}

$user = $result->fetch_assoc();
// if (!password_verify($password, $user['password'])) {
//     json_error('Incorrect password.', 401);
// }

if($user['password'] !== $password) {
    json_error('Incorrect password.', 401);
}

$role = strtolower($user['role']);
if (!in_array($role, ['admin', 'cashier'], true)) {
    json_error('Invalid role assigned to the user.', 403);
}

$_SESSION['username'] = $user['username'];
$_SESSION['role'] = $role;

json_success(['username' => $user['username'], 'role' => $role]);