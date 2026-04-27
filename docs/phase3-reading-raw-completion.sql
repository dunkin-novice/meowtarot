-- Phase 3 raw completion data foundation (2026-04-27)
-- Safe to run multiple times.

alter table if exists public.readings
  add column if not exists topic text;

alter table if exists public.readings
  add column if not exists completed_at timestamptz not null default now();
