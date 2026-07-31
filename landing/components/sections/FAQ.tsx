import { AccordionItem, Section } from "@/components/ui";

// Le prix est la question qui décide, donc sa réponse est ouverte : six lignes
// repliées juste avant le CTA final se lisent comme un mur, pas comme une
// réassurance. La question sécurité n'est pas ouverte ici parce que le CTA final
// porte désormais l'essentiel de sa réponse, à l'endroit où on hésite.
interface FaqItem {
  question: string;
  answer: string;
  isOpen?: boolean;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Pourquoi Pulpe plutôt qu’Excel ?",
    answer: "Excel fait le job, mais les formules deviennent vite fragiles dès que tu bouges une ligne. Et sur mobile, c’est pénible. Pulpe garde la vue d’ensemble et recalcule la suite quand tu ajustes ton budget.",
  },
  {
    question: "C’est vraiment gratuit ?",
    answer: "Oui. Pulpe est aujourd’hui gratuit, sans publicité ni abonnement. Le projet est personnel et son code source est public.",
    isOpen: true,
  },
  {
    question: "Je récupère mes données si j’arrête ?",
    answer: "Oui. Tu peux exporter tes budgets depuis l’app. Tes données ne sont pas enfermées dans Pulpe.",
  },
  {
    question: "Mes montants sont-ils protégés ?",
    answer: "Oui. Tes montants ne sont jamais stockés en clair. Ils sont chiffrés en base avec AES-256-GCM. Ils sont déchiffrés côté serveur pendant tes requêtes authentifiées grâce à deux clés conservées séparément, dont une dérivée de ton code PIN. Une fuite de la base seule ne suffit donc pas à les lire. Tes montants et libellés financiers ne sont ni transmis à des fins publicitaires ni revendus. Le code source est public.",
  },
  {
    question: "Pourquoi pas de connexion à ma banque ?",
    answer: "J’aurais aimé proposer une synchronisation bancaire. Pour le faire correctement en Suisse et en France, il faut passer par des prestataires externes et gérer des contraintes réglementaires. Pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. Donc, pour l’instant, la saisie reste manuelle.",
  },
  {
    question: "Combien de temps faut-il pour commencer ?",
    answer: "Quelques minutes suffisent : renseigne un mois habituel, ajoute les dépenses ponctuelles que tu connais, puis consulte la projection de ton année.",
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
            <AccordionItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              defaultOpen={item.isOpen}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
