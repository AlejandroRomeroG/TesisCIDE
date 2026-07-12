.PHONY: scrape clusters

QUARTO ?= $(shell if [ -x .tools/quarto/bin/quarto ]; then echo .tools/quarto/bin/quarto; else echo quarto; fi)

scrape:
	LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 $(QUARTO) render ScrapingTesisLicEcoCIDE.qmd --execute

clusters:
	.venv/bin/jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=-1 --inplace mapa_semantico_tesis.ipynb
	.venv/bin/jupyter nbconvert --to notebook --ClearOutputPreprocessor.enabled=True --inplace mapa_semantico_tesis.ipynb
