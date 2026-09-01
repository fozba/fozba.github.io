# Curriculum Vitae source

The public CV is generated from `fehmi_ozbayrak_cv.tex` with pdfLaTeX. Career facts
must remain consistent with the canonical records in the sibling
`career_workspace/resume-system/profile/` directory.

Build from this directory with:

```bash
latexmk -pdf -interaction=nonstopmode -halt-on-error fehmi_ozbayrak_cv.tex
```

After text and visual QA, copy the checked PDF to both
`static/files/fehmi_ozbayrak_cv.pdf` and the legacy-compatible
`static/files/ozbayrak_fehmi_resume.pdf` path.
