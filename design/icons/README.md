# Icon Assets

## Structure

```
design/icons/
├── source/           # SVG source files (versioned)
├── icon-composer.icon # Icon Composer project file (versioned)
└── *.png            # Generated exports (ignored by git)
```

## Workflow

1. Edit icons in `icon-composer.icon` using Apple's Icon Composer app
2. Export PNG assets as needed (they won't be committed)
3. Source SVG files in `source/` are versioned for reference

## Notes

- PNG exports are gitignored to keep the repository lean
- All source files (SVG, .icon) are versioned for reproducibility
- Avoid manual version suffixes (v2, v3) - use git history instead
