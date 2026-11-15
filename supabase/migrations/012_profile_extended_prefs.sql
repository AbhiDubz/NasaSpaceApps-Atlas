-- Extend public.profiles with full workstation state so data layers, time filter,
-- tactical/detection modes, and guided-tour decision persist per account.

alter table public.profiles
  add column if not exists data_layers jsonb,
  add column if not exists time_filter text default 'live',
  add column if not exists tactical_mode boolean default false,
  add column if not exists detection_mode boolean default false,
  add column if not exists detection_label_density text default 'sparse',
  add column if not exists tour_state jsonb;
