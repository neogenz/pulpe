#!/bin/bash

# Script de test INTENSIF du rate limiting (1000+ requêtes)
# Usage: ./scripts/test-rate-limiting-heavy.sh <BEARER_TOKEN> <API_URL>
#
# ATTENTION: Ce script fait 1010 requêtes pour vérifier que la limite de 1000 fonctionne
#
# Exemple:
#   ./scripts/test-rate-limiting-heavy.sh "eyJhbGci..." "http://localhost:3000/api/v1"

set -e

# Configuration
BEARER_TOKEN="${1:-}"
API_URL="${2:-http://localhost:3000/api/v1}"
ENDPOINT="/budgets"
TOTAL_REQUESTS=1010  # Dépasser la limite de 1000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction d'aide
show_help() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Test INTENSIF du Rate Limiting (1010 requêtes)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Usage: $0 <BEARER_TOKEN> [API_URL]"
  echo ""
  echo -e "${RED}⚠️  ATTENTION: Ce script fait 1010 requêtes rapidement!${NC}"
  echo ""
  echo "Exemples:"
  echo "  $0 'eyJhbGci...' 'http://localhost:3000/api/v1'  # Local"
  echo "  $0 'eyJhbGci...' 'https://api.pulpe.ch/api/v1'   # Production"
  echo ""
  echo "Objectif:"
  echo "  - Vérifier que le rate limiting s'active à 1000 requêtes"
  echo "  - Confirmer que c'est basé sur user.id (pas IP)"
  echo "  - Observer les headers X-RateLimit-*"
  echo ""
  echo -e "${YELLOW}Pré-requis:${NC}"
  echo "  - Token JWT valide"
  echo "  - API accessible"
  echo "  - Endpoint GET $ENDPOINT existant"
  echo ""
  exit 1
}

# Vérifier les paramètres
if [ -z "$BEARER_TOKEN" ]; then
  echo -e "${RED}❌ Erreur: Bearer token manquant${NC}"
  echo ""
  show_help
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Test INTENSIF: $TOTAL_REQUESTS Requêtes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${RED}⚠️  ATTENTION: Ce test va faire $TOTAL_REQUESTS requêtes rapidement!${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  API URL        : $API_URL"
echo "  Endpoint       : $ENDPOINT"
echo "  Total requêtes : $TOTAL_REQUESTS"
echo "  Limite attendue: 1000 req/minute"
echo "  Token          : ${BEARER_TOKEN:0:20}..."
echo ""
read -p "Appuyer sur ENTER pour continuer (Ctrl+C pour annuler)..."
echo ""

# Compteurs
SUCCESS_COUNT=0
ERROR_429_COUNT=0
OTHER_ERROR_COUNT=0
FIRST_429_AT=0

# Timestamp de début
START_TIME=$(date +%s)

echo -e "${YELLOW}Envoi de $TOTAL_REQUESTS requêtes...${NC}"
echo ""

# Boucle de requêtes avec affichage tous les 100
for i in $(seq 1 $TOTAL_REQUESTS); do
  # Faire la requête (silencieux sauf erreurs)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $BEARER_TOKEN" \
    -H "Accept: application/json" \
    "${API_URL}${ENDPOINT}" 2>&1)

  # Compter selon le résultat
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))

    # Afficher une progress bar tous les 100
    if [ $((i % 100)) -eq 0 ]; then
      echo -e "${GREEN}✓ $i/$TOTAL_REQUESTS requêtes${NC} | Succès: $SUCCESS_COUNT | 429: $ERROR_429_COUNT"
    fi
  elif [ "$HTTP_CODE" = "429" ]; then
    ERROR_429_COUNT=$((ERROR_429_COUNT + 1))

    # Capturer le numéro de la première 429
    if [ $FIRST_429_AT -eq 0 ]; then
      FIRST_429_AT=$i
      echo ""
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${RED}  🚨 RATE LIMIT ATTEINT !${NC}"
      echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo ""
      echo -e "  Première 429 à la requête: ${RED}$FIRST_429_AT${NC}"
      echo -e "  Requêtes réussies avant:   ${GREEN}$SUCCESS_COUNT${NC}"
      echo ""

      # Capturer les headers de la requête 429 pour vérifier
      RESPONSE_429=$(curl -s -w "\n%{header_json}" \
        -H "Authorization: Bearer $BEARER_TOKEN" \
        "${API_URL}${ENDPOINT}" 2>&1)

      HEADERS_429=$(echo "$RESPONSE_429" | tail -n 1)
      LIMIT_429=$(echo "$HEADERS_429" | grep -o '"x-ratelimit-limit":\["[0-9]*"\]' | grep -o '[0-9]*' || echo "N/A")
      REMAINING_429=$(echo "$HEADERS_429" | grep -o '"x-ratelimit-remaining":\["[0-9]*"\]' | grep -o '[0-9]*' || echo "0")
      RESET_429=$(echo "$HEADERS_429" | grep -o '"x-ratelimit-reset":\["[0-9]*"\]' | grep -o '[0-9]*' || echo "N/A")

      if [ "$RESET_429" != "N/A" ]; then
        RESET_TIMESTAMP=$(date -r "$RESET_429" "+%H:%M:%S" 2>/dev/null || echo "N/A")
        echo -e "  ${YELLOW}Headers Rate Limit:${NC}"
        echo "    X-RateLimit-Limit     : $LIMIT_429"
        echo "    X-RateLimit-Remaining : $REMAINING_429"
        echo "    X-RateLimit-Reset     : $RESET_429 ($RESET_TIMESTAMP)"
        echo ""
      fi

      echo -e "  ${YELLOW}Continuant le test pour vérifier la persistance...${NC}"
      echo ""
    fi

    # Afficher progress tous les 10 après le premier 429
    if [ $((i % 10)) -eq 0 ]; then
      echo -e "${RED}  → Requête $i: Toujours bloqué (429)${NC}"
    fi
  else
    OTHER_ERROR_COUNT=$((OTHER_ERROR_COUNT + 1))
    echo -e "${RED}✗ Requête $i: HTTP $HTTP_CODE (ERREUR INATTENDUE)${NC}"
  fi
done

# Timestamp de fin
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Résultats Finaux${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}✓ Succès:${NC}          $SUCCESS_COUNT/$TOTAL_REQUESTS"
echo -e "  ${RED}✗ Rate Limited (429):${NC} $ERROR_429_COUNT/$TOTAL_REQUESTS"
echo -e "  ${RED}✗ Autres erreurs:${NC}     $OTHER_ERROR_COUNT/$TOTAL_REQUESTS"
echo ""
echo -e "  Durée totale:      ${DURATION}s"
echo -e "  Requêtes/seconde:  $((TOTAL_REQUESTS / DURATION)) req/s"
echo ""

# Analyse des résultats
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Analyse${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FIRST_429_AT -gt 0 ]; then
  echo -e "${GREEN}✅ Rate limiting fonctionne correctement !${NC}"
  echo ""
  echo "  Premier 429 reçu à: requête #$FIRST_429_AT"
  echo "  Tolérance observée: $SUCCESS_COUNT requêtes avant blocage"
  echo ""

  if [ $SUCCESS_COUNT -ge 990 ] && [ $SUCCESS_COUNT -le 1010 ]; then
    echo -e "  ${GREEN}✓ Limite autour de 1000 req/min comme configuré${NC}"
  elif [ $SUCCESS_COUNT -lt 100 ]; then
    echo -e "  ${RED}⚠️  Limite très basse ($SUCCESS_COUNT) - vérifier la config${NC}"
  else
    echo -e "  ${YELLOW}⚠️  Limite à $SUCCESS_COUNT (attendu: ~1000)${NC}"
  fi

  echo ""
  echo -e "${YELLOW}💡 Pour vérifier que c'est basé sur user.id:${NC}"
  echo ""
  echo "  1. Relance immédiatement ce script avec le MÊME token:"
  echo "     → Devrait être bloqué dès la 1ère requête (429)"
  echo ""
  echo "  2. Relance avec un AUTRE user/token:"
  echo "     → Devrait recommencer à 0 (limite indépendante)"
  echo ""
  echo "  3. Attends 60 secondes puis relance:"
  echo "     → Le compteur devrait être réinitialisé"
  echo ""
else
  echo -e "${YELLOW}⚠️  Aucun rate limiting détecté${NC}"
  echo ""
  echo "  Toutes les $TOTAL_REQUESTS requêtes ont réussi."
  echo ""
  echo "  Causes possibles:"
  echo "    - UserThrottlerGuard n'est pas actif"
  echo "    - @SkipThrottle() présent sur le controller"
  echo "    - Config rate limit trop haute (>1010 req/min)"
  echo ""
  echo -e "${YELLOW}Vérifications recommandées:${NC}"
  echo "    - backend-nest/src/app.module.ts: useClass: UserThrottlerGuard"
  echo "    - backend-nest/src/modules/budget/budget.controller.ts: pas de @SkipThrottle()"
  echo "    - Logs backend pour voir si le guard s'exécute"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
