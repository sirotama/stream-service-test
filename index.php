<?php
require "vendor/autoload.php";
$path = !empty($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '/';
echo $path;
switch(true){
    case $path === "/":
        echo "hello world!";
        break;
    default:
        echo "notfound";
        break;
} ?>
