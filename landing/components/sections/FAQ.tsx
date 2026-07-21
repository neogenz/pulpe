import { AccordionItem, Section } from "@/components/ui";

const FAQ_ITEMS = [
  {
    q: "Pourquoi Pulpe plutôt qu’Excel ou YNAB ?",
    a: "Pulpe sert à planifier les mois qui viennent, pas à surveiller chaque dépense au jour le jour. Dans Excel, tu dois construire et entretenir toi-même les formules. YNAB part surtout de l’argent déjà disponible. Avec Pulpe, tu places tes revenus et les dépenses à venir au bon mois. Chaque surplus ou déficit se reporte automatiquement sur les mois suivants, pour te montrer si ton plan tient jusqu’à la fin de l’année.",
  },
  {
    q: "C’est vraiment gratuit ?",
    a: "Oui. Pulpe est aujourd’hui gratuit, sans publicité ni abonnement. Le projet est personnel et son code source est public.",
  },
  {
    q: "Je récupère mes données si j’arrête ?",
    a: "Oui. Tu peux exporter tes budgets depuis l’app. Tes données ne sont pas enfermées dans Pulpe.",
  },
  {
    q: "Mes montants sont-ils protégés ?",
    a: "Oui. Ils ne sont jamais stockés en clair dans la base. Pulpe les chiffre avec AES-256-GCM à l’aide de deux clés conservées séparément. Une fuite de la base seule ne suffit donc pas à les lire.",
  },
  {
    q: "Pourquoi pas de connexion à ma banque ?",
    a: "C’est volontaire. Pulpe ne demande aucun accès à tes comptes. Tu gardes la main sur ce que tu ajoutes et ce que tu pointes.",
  },
  {
    q: "Combien de temps faut-il pour commencer ?",
    a: "Quelques minutes suffisent : renseigne un mois habituel, ajoute les dépenses ponctuelles que tu connais, puis consulte la projection de ton année.",
  },
];

export function FAQ() {
  return (
    <Section id="faq">
      <div className="mx-auto max-w-3xl">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
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
