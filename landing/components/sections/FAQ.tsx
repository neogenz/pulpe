import { AccordionItem, Section } from "@/components/ui";

const FAQ_ITEMS = [
  {
    q: "C’est vraiment gratuit ?",
    a: "Oui. Pulpe est aujourd’hui gratuit, sans publicité ni abonnement. Le projet est personnel et son code source est public.",
  },
  {
    q: "Je récupère mes données si j’arrête ?",
    a: "Oui. Tu peux exporter tes budgets depuis l’app. Tes données ne sont pas enfermées dans Pulpe.",
  },
  {
    q: "Tu peux lire mes montants ?",
    a: "Tes montants sont chiffrés avec AES-256-GCM. Leur lecture demande la clé dérivée de ton code PIN et un secret conservé côté serveur ; une fuite de la base seule ne suffit pas.",
  },
  {
    q: "Pourquoi pas de connexion à ma banque ?",
    a: "C’est volontaire. Pulpe ne demande aucun accès à tes comptes. Tu gardes la main sur ce que tu ajoutes et ce que tu pointes.",
  },
  {
    q: "Il faut combien de temps pour commencer ?",
    a: "Environ 3 minutes : renseigne ton mois type, place les exceptions, puis lis la projection de ton année.",
  },
  {
    q: "Ça marche sur quoi ?",
    a: "Dans ton navigateur, sans rien installer, et dans l’app iOS native. L’app Android est en cours.",
  },
];

export function FAQ() {
  return (
    <Section id="faq">
      <div className="mx-auto max-w-3xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Avant de commencer</p>
          <h2 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Les réponses courtes aux vraies questions.
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </Section>
  );
}
