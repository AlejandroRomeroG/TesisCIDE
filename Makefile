.PHONY: scrape clusters

QUARTO ?= $(shell if [ -x .tools/quarto/bin/quarto ]; then echo .tools/quarto/bin/quarto; else echo quarto; fi)

scrape:
	$(QUARTO) render ScrapingTesisLicEcoCIDE.qmd --execute

clusters:
	.venv/bin/jupyter nbconvert --to notebook --execute --inplace mapa_semantico_tesis.ipynb
	.venv/bin/jupyter nbconvert --to notebook --ClearOutputPreprocessor.enabled=True --ClearMetadataPreprocessor.enabled=True --inplace mapa_semantico_tesis.ipynb
