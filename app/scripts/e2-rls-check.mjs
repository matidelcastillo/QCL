#!/usr/bin/env bun
// Light E2 check: two throwaway users should only see their own books.
// Reads VITE_SUPABASE_* from the environment or app/.env. Never prints keys.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const path = resolve(import.meta.dir, "../.env");
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env may already be set
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Faltan VITE_SUPABASE_URL y la clave pública.");
  process.exit(1);
}

const stamp = Date.now();
const users = [
  { email: `qcl-e2-a-${stamp}@example.com`, password: `E2-a-${stamp}-ok`, title: "Libro de A" },
  { email: `qcl-e2-b-${stamp}@example.com`, password: `E2-b-${stamp}-ok`, title: "Libro de B" },
];

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const ids = [];

try {
  const sessions = [];
  for (const user of users) {
    const supabase = client();
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
    });
    if (error) throw new Error(`signup ${user.email}: ${error.message}`);
    if (!data.session || !data.user) {
      throw new Error(`signup ${user.email}: no hubo sesión (¿hace falta confirmar el email?)`);
    }
    ids.push(data.user.id);
    const { error: insertError } = await supabase.from("books").insert({
      owner_id: data.user.id,
      title: user.title,
      author: "Prueba",
      status: "quiero",
    });
    if (insertError) throw new Error(`insert ${user.email}: ${insertError.message}`);
    sessions.push({ user, supabase, id: data.user.id });
  }

  const [a, b] = sessions;
  const { data: aRows, error: aError } = await a.supabase
    .from("books")
    .select("id, title, owner_id");
  if (aError) throw aError;
  const { data: bRows, error: bError } = await b.supabase
    .from("books")
    .select("id, title, owner_id");
  if (bError) throw bError;

  if (aRows.length !== 1 || aRows[0].title !== users[0].title || aRows[0].owner_id !== a.id) {
    throw new Error(`A vio filas inesperadas: ${aRows.length}`);
  }
  if (bRows.length !== 1 || bRows[0].title !== users[1].title || bRows[0].owner_id !== b.id) {
    throw new Error(`B vio filas inesperadas: ${bRows.length}`);
  }

  const { data: stolen, error: stealError } = await a.supabase
    .from("books")
    .update({ title: "no debería" })
    .eq("id", bRows[0].id)
    .select("id");
  if (stealError) throw stealError;
  if (stolen && stolen.length > 0) throw new Error("A pudo editar un libro de B");

  const { data: removed, error: deleteError } = await a.supabase
    .from("books")
    .delete()
    .eq("id", bRows[0].id)
    .select("id");
  if (deleteError) throw deleteError;
  if (removed && removed.length > 0) throw new Error("A pudo sacar un libro de B");

  console.log("PASS: cada usuario ve y toca solo sus libros.");
  console.log(JSON.stringify({ userIds: ids }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log(JSON.stringify({ userIds: ids }));
  process.exitCode = 1;
}
