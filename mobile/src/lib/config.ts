import { Platform } from "react-native";

import type { SessionMode } from "./api";

/**
 * Adresse de l'API (EXPO_PUBLIC_API_BASE_URL, intégrée au moment du build).
 * - Téléphone : défaut = staging.
 * - Navigateur (PWA) : défaut = même origine (« /api/… » relayé vers l'API par Vercel ou par
 *   l'aperçu local), pour que le cookie de session reste de premier rang.
 */
const fallback = Platform.OS === "web" ? "" : "https://api-staging.pestai.africa";
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? fallback).replace(/\/+$/, "");

/** Session : coffre sécurisé sur téléphone, cookie httpOnly dans le navigateur. */
export const SESSION_MODE: SessionMode = Platform.OS === "web" ? "cookie" : "native";

/** Délai maximal d'une requête : au-delà, on considère le réseau comme indisponible. */
export const REQUEST_TIMEOUT_MS = 20_000;
