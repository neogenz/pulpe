#!/bin/bash

# Script pour concaténer tous les fichiers du memory-bank dans un fichier memory-bank.md
# Usage: ./concat-memory-bank.sh

set -e  # Arrêter le script en cas d'erreur

MEMORY_BANK_DIR="memory-bank"
OUTPUT_FILE="memory-bank.md"
DATE_GENERATION=$(date '+%Y-%m-%d %H:%M:%S')

# Vérifier que le dossier memory-bank existe
if [ ! -d "$MEMORY_BANK_DIR" ]; then
    echo "Erreur: Dossier $MEMORY_BANK_DIR introuvable"
    exit 1
fi

# Fonction pour ajouter une section avec séparateur
add_section() {
    local file_path="$1"
    local section_title="$2"

    if [ -f "$file_path" ]; then
        echo "" >> "$OUTPUT_FILE"
        echo "---" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "## $section_title" >> "$OUTPUT_FILE"
        echo "*Source: $file_path*" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$file_path" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    else
        echo "⚠️  Fichier $file_path introuvable, section ignorée" >&2
    fi
}

# Créer le fichier de sortie
echo "# Memory Bank - Documentation complète" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Généré le: $DATE_GENERATION" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Table des matières
echo "## Table des matières" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "- [Project Brief](#project-brief)" >> "$OUTPUT_FILE"
echo "- [Specifications](#specifications)" >> "$OUTPUT_FILE"
echo "- [Design](#design)" >> "$OUTPUT_FILE"
echo "- [Architecture](#architecture)" >> "$OUTPUT_FILE"
echo "- [Database](#database)" >> "$OUTPUT_FILE"
echo "- [Infrastructure](#infrastructure)" >> "$OUTPUT_FILE"
echo "- [Codebase Structure](#codebase-structure)" >> "$OUTPUT_FILE"
echo "- [Decisions](#decisions)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Concaténer les fichiers dans l'ordre logique
add_section "$MEMORY_BANK_DIR/PROJECT_BRIEF.md" "Project Brief"
add_section "$MEMORY_BANK_DIR/SPECS.md" "Specifications"
add_section "$MEMORY_BANK_DIR/DESGIN.md" "Design"
add_section "$MEMORY_BANK_DIR/ARCHITECTURE.md" "Architecture"
add_section "$MEMORY_BANK_DIR/DATABASE.mmd" "Database"
add_section "$MEMORY_BANK_DIR/INFRASTRUCTURE.md" "Infrastructure"
add_section "$MEMORY_BANK_DIR/CODEBASE_STRUCTURE.md" "Codebase Structure"
add_section "$MEMORY_BANK_DIR/DECISION.md" "Decisions"

echo "✅ Fichier $OUTPUT_FILE généré avec succès"
echo "📊 $(wc -l < "$OUTPUT_FILE") lignes écrites"