# Task: Backend API - Endpoint PATCH /budget-lines/:id/check

## Problem

Il n'existe pas d'endpoint API pour cocher/décocher une ligne budgétaire. Le frontend a besoin d'un endpoint dédié pour mettre à jour le champ `checked_at` d'une ligne.

## Proposed Solution

Créer un endpoint `PATCH /budget-lines/:id/check` qui accepte un body `{ checked: boolean }` et met à jour le champ `checked_at` en conséquence (timestamp si true, null si false).

## Dependencies

- Task #1: Migration DB (colonne checked_at)
- Task #2: Shared Schema (type BudgetLine)

## Context

- Controller: `backend-nest/src/modules/budget-line/budget-line.controller.ts`
- Service: `backend-nest/src/modules/budget-line/budget-line.service.ts`
- Mappers: `backend-nest/src/modules/budget-line/budget-line.mappers.ts`
- DTOs: `backend-nest/src/modules/budget-line/dto/budget-line-swagger.dto.ts`
- Pattern similaire: `resetFromTemplate` endpoint (controller lignes 152-182)
- Méthode existante réutilisable: `updateBudgetLineInDb` (service ligne 310)

## Success Criteria

- Mapper `toApi` inclut le champ `checkedAt` (snake_case → camelCase)
- DTO `BudgetLineCheckDto` créé avec propriété `checked: boolean`
- DTO `BudgetLineResponseDto` inclut `checkedAt`
- Service `toggleCheck(id, checked, user, supabase)` créé
- Controller endpoint `PATCH :id/check` fonctionnel
- Documentation Swagger complète
- Tests unitaires service + controller
- Pas de recalcul de balances (checked_at n'affecte pas les totaux prévisionnels)
