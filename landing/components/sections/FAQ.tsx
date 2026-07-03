import { Section, FadeIn, AccordionItem } from '@/components/ui'

const FAQ_ITEMS = [
  {
    q: "C'est vraiment gratuit ? Où est le piège ?",
    a: "Pas de piège. Pas de pub, pas d'abonnement caché, pas de revente de données. C'est un projet perso que j'utilise chaque jour. Si un plan payant arrive un jour, ce que tu as reste gratuit — et tes données restent exportables.",
  },
  {
    q: 'Je récupère mes données si j’arrête ?',
    a: 'Oui, quand tu veux. Tu peux exporter tes données à tout moment, et le code est open source — rien n’est enfermé.',
  },
  {
    q: 'Tu peux voir combien j’ai sur mon compte ?',
    a: 'Non. Tes montants sont chiffrés avant d’être stockés. Personne ne peut les lire — même pas moi.',
  },
  {
    q: 'Pourquoi pas de connexion à ma banque ?',
    a: "C'est un choix. Pas de connexion bancaire = pas d'accès à tes comptes, pas de données sensibles qui transitent. Tu notes tes dépenses en deux clics, et tu gardes le contrôle.",
  },
  {
    q: 'Il faut combien de temps pour commencer ?',
    a: 'Environ 3 minutes : tes revenus, tes charges fixes, tes dépenses courantes. Ensuite Pulpe planifie ton année et tu n’as plus qu’à pointer au fil du mois.',
  },
  {
    q: 'Ça marche sur quoi ?',
    a: 'Dans ton navigateur, tout de suite, sans rien installer. Il y a aussi une app iOS native. Android arrive.',
  },
]

export function FAQ() {
  return (
    <Section id="faq" background="grain">
      <div className="max-w-3xl mx-auto">
        <FadeIn variant="blur">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-12 tracking-[-0.02em] balance">
            Tout ce que tu te{' '}
            <span className="italic font-normal text-primary">demandes.</span>
          </h2>
        </FadeIn>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FadeIn key={item.q} variant="blur" delay={index * 0.05}>
              <AccordionItem question={item.q} answer={item.a} />
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  )
}
