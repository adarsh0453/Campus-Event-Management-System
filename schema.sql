-- MySQL Database Schema for Campus Event Management System

CREATE DATABASE IF NOT EXISTS `campus_events`;
USE `campus_events`;

-- Create tables if they do not exist (safe for re-runs)

-- Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events Table
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(255) PRIMARY KEY,
  `event_name` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(255) NOT NULL,
  `event_date` DATE NOT NULL,
  `event_time` VARCHAR(50) DEFAULT 'TBA',
  `venue` VARCHAR(255) NOT NULL,
  `max_capacity` INT NOT NULL,
  `organizer` VARCHAR(255) NOT NULL,
  `organizer_id` VARCHAR(255) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`organizer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registrations / Attendees Table
CREATE TABLE IF NOT EXISTS `registrations` (
  `event_id` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`, `user_id`),
  FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
