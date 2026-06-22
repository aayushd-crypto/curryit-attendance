-- Notifications table
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users see own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "Users update own notifications"
  on notifications for update using (auth.uid() = user_id);

create policy "Admins insert notifications"
  on notifications for insert with check (true);
