import { AccordionItem, Section } from "@/components/ui";

const FAQ_ITEMS = [
  {
    q: "Pourquoi Pulpe plutôt qu’Excel ?",
    a: "Excel fait le job, mais les formules deviennent vite fragiles dès que tu bouges une ligne. Et sur mobile, c’est pénible. Pulpe garde la vue d’ensemble et recalcule la suite quand tu ajustes ton budget.",
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
    a: "Oui. Tes montants ne sont jamais stockés en clair. Ils sont chiffrés en base avec AES-256-GCM. Ils sont déchiffrés côté serveur pendant tes requêtes authentifiées grâce à deux clés conservées séparément, dont une dérivée de ton code PIN. Une fuite de la base seule ne suffit donc pas à les lire. Tes montants et libellés financiers ne sont ni transmis à des fins publicitaires ni revendus. Le code source est public.",
  },
  {
    q: "Pourquoi pas de connexion à ma banque ?",
    a: "J’aurais aimé proposer une synchronisation bancaire. Pour le faire correctement en Suisse et en France, il faut passer par des prestataires externes et gérer des contraintes réglementaires. Pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. Donc, pour l’instant, la saisie reste manuelle.",
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
            Les questions qu&apos;on me pose le plus.
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
