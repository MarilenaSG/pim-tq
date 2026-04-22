-- La app no tiene auth de usuario. Las lecturas de campaigns y campaign_products
-- deben ser accesibles con la anon key (service role ya bypasea RLS).
drop policy if exists "auth_read_campaigns"         on campaigns;
drop policy if exists "auth_read_campaign_products" on campaign_products;

create policy "anon_read_campaigns"
  on campaigns for select using (true);

create policy "anon_read_campaign_products"
  on campaign_products for select using (true);
