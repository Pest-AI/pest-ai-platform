import { redirect } from "next/navigation";

/** L'accueil renvoie vers le choix de l'espace (le proxy gère la connexion). */
export default function Home() {
  redirect("/espaces");
}
