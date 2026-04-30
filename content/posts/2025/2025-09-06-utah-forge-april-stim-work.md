---
title: "Utah FORGE - April Stimulation Work"
date: 2025-09-06T00:00:20+00:00
hero: /posts/2025-09-06-utah-forge-april-stim-work/datasets_overview.png
theme: Toha
math: true
menu:
  sidebar:
    name: Utah FORGE - April Stimulation Work
    identifier: 2025-09-06-utah-forge-april-stim-work
    parent: 2025-posts
    weight: -5
---

## Summary

As mentioned in the previous post, we recently joined the [2025 GEODE Datathon](https://www.geode.energy/news/geode-datathon-winners-announced) with a friend as a team of 2. The competition had two tracks: Engineering and Geosciences. In this post, I will talk about what we have done for the Engineering challenge (where we got the 2nd place).

[Utah FORGE](https://utahforge.com/) is a project by [DOE](https://www.energy.gov/eere/geothermal/enhanced-geothermal-systems), where the world's first "open-source" [EGS](https://en.wikipedia.org/wiki/Enhanced_geothermal_system) was built. Here, by open-source, what I mean is that almost every data in this project is shared publicly (you can find it all on the [Geothermal Data Repository](https://gdr.openei.org/)), so that the geothermal world can benefit from this research to build a better collective understanding of the geothermal energy and EGS.

*(Side note: Aside from the Utah FORGE, the other most important project was the [Fenton Hill Project](https://en.wikipedia.org/wiki/Hot_dry_rock_geothermal_energy), where the data is not open as FORGE. But this work kind of parented almost all EGS work we are seeing today, including SoTA attempts like [Fervo](https://fervoenergy.com/), so, it would be very good to know about this, if you are interested in geothermal and particularly in EGS.)*

Among the shared files, we have a collection of data with regard to the stimulation performed on the project wells 16A and 16B on April 2024. The Engineering Challenge for 2025 GEODE Datathon was essentially to "do something" with this data, and that something is up to the teams, but the main way that almost every team went with it was to do an integrated data analysis, which is also what we did.

## Overview of the problem and the data

So, between 4th of April and 28th of April, wells 16A and 16B were stimulated, and after the stimulation, a [short circulation test](https://utahforge.com/press-release-stimcirc-tests/) was done. During this operation, many different data was collected, such as fiber optic data, tracer tests and seismic data.

Briefly, 16A is the injector and 16B is the producer. The two wells are parallel, with lateral sections at 65 degrees from vertical, and vertically separated by ~300 ft. 16A was hydraulically fractured in 8 stages (3 re-fractured intervals + 7 new ones), and 16B was stimulated in a few stages with smaller volumes. After all of this, a 9-hour circulation test was done where ~15 bpm was injected into 16A, and ~8 bpm was produced back from 16B, meaning ~70% recovery, with the produced water reaching ~139°C. This was a major moment for EGS, since it confirmed that an engineered reservoir in hot dry granite can sustain an actual flow at meaningful rates and temperatures.

The "broad array of datasets" we had to work with included:

- Fiber optic data (DAS, DSS, DTS) from 16B during 16A's stimulation and the circulation test
- Tracer test data (different tracers per stage, recovered during the circulation test)
- Pressure & temperature gauge data
- Microseismic events catalogue
- Stimulation pumping data with stage information
- Detailed wellbore surveys

![Sample of the datasets used in our workflow. Fiberoptic (top left), tracer (top right), stimulation/stage data (bottom left), and wellbore surveys (bottom right). Retrieved from https://gdr.openei.org/](/posts/2025-09-06-utah-forge-april-stim-work/datasets_overview.png)

The challenge essentially asks: *given all of this, what can you say about the reservoir, and what would you do next?* So that is what we tried to answer.

## Tracer test insights

The tracer test is one of the cleanest ways to understand inter-well connectivity. Each stage in 16A was tagged with a different tracer during stimulation, and during the 9-hour circulation test, fluid produced from 16B was sampled and the recovered tracer concentrations were measured. If a stage in 16A contributes a lot to the produced flow, its tracer shows up strongly in 16B.

We did two types of analysis here:

**1. Total tracer recovery per stage.** When we look at the raw recovery percentage, the number of clusters per stage clearly impacts connectivity: stages with more clusters returned more tracer. That is honestly an expected result, but it is good to confirm it with the data.

**2. Normalized recovery (per cluster).** When we normalize the tracer concentration by the number of clusters, the picture changes: each stage shows approximately equal connectivity per cluster. In other words, on a *per-cluster* basis, the effectiveness is comparable across stages. This is a useful insight for completion design discussions: if each cluster is doing roughly the same work, then the total contribution is essentially a function of cluster count and placement.

We also looked at the **correlation matrix of recovered tracer concentrations** across stages. Most stages show high correlation with each other, meaning the flow paths from these stages are interconnected or share similar hydraulic properties. The notable exception is **Stage 4**, which shows distinctly low correlation with the rest, suggesting it may be tapping into a different (or more isolated) part of the fracture network.

![Tracer test plots and the correlation matrix of recovered tracer concentrations across stages.](/posts/2025-09-06-utah-forge-april-stim-work/tracer_plots.png)

## Fiberoptic data insights

The fiber optic data, particularly the DTS (Distributed Temperature Sensing), is in my opinion, the most "story-telling" dataset of the whole project. You can literally see the thermal signature of fluid moving along the wellbore over time, and that lets you locate where flow is entering or leaving the wellbore.

![DTS Δ-T plot for the April stimulation and circulation test. Note the persistent preferential flow paths emerging after S2 and S4. Data from https://gdr.openei.org/, courtesy of Neubrex.](/posts/2025-09-06-utah-forge-april-stim-work/dts_deltaT.png)

Before going into what we see, a quick note on how this plot is read. The vertical axis is **measured depth** along the 16B wellbore (top of the well at the top, toe at the bottom), and the horizontal axis is **time** across the April operation. The color is **temperature change** (Δ-T) relative to a reference trace, so red means the wellbore got warmer at that depth and time, blue means it got cooler. Cool blue streaks are typically the signature of fluid flow: cold injected/circulating water entering the wellbore at a given depth and pulling the local temperature down. The longer and more persistent a blue streak is at a given depth, the more sustained the flow at that point. Hot red streaks, on the other hand, usually indicate warm-back periods (no flow, formation re-heating the wellbore) or warmer fluid arrivals. The vertical labels (S1, S2, S3R, ...) mark the stages, and the small panel below shows the P/T gauge data at 7057 ft for context.

Looking at the DTS Δ-T plot for 16B across the whole April operation, two things become very clear:

- Notice that after **Stage 2 (S2)** of 16B's stimulation (late hours of April 13), we see a "blue line" persisting, and it stays visible all the way through the end of stimulation, including during the circulation test. The depth of this flow path corresponds exactly to S2's perforation depth. Notice that when S3 was stimulated, a similar line at S3's perforation depth **does not appear** and instead, the same blue line from S2 persists. This tells us that there is a **preferential flow path** where the perforations of 16B's Stage 2 are.
- The **same phenomenon** appears after **Stage 4 (S4)**, again at the matching depth.
- This means these preferential flow paths were either *created* or *significantly enhanced* during S2 and S4.
- Lastly, notice that during the stimulation of 16A, around 5th of April, we stop getting any meaningful data below ~9700 ft. This is because the fiber optic cable was damaged during this operation. Therefore, **Stage 1 (S1)**, which corresponds to this "lost" interval, could have a similar story, but we cannot confirm it from DTS since the fiber failed at S1 depth.

So between the tracer test and the fiber, we have two independent signals telling us that **certain stages dominate the flow path** in the post-stimulation reservoir.

## Microseismic events

Now to the seismic side of the story. The microseismic catalogue gives us locations of small fracture-induced events recorded during the operation. One thing we wanted to do was to see how the rate of events evolves over the operation.

We binned the catalogue by 1-hour intervals and plotted event rate vs time. As expected, the **peak event rates correspond directly to the stimulation stages** (when the fracture is stimulated/activated or propagating, the rock cracks the most, the recorded event rate spikes). So if you can identify the peaks, you essentially have a fingerprint of which fractures are being created when.

![Microseismic event rate (events per hour) for the April stimulation. Each labeled peak corresponds to a stimulation stage.](assets/posts/2025-09-06-utah-forge-april-stim-work/ms_rate.png)

A small but important caveat: the catalogue effectively stops after April 15, which means we cannot see the full microseismic story for the last few stages. Worth flagging because it limits how complete our picture is.

We then took the **events occurring at peak times** (i.e. the events most clearly associated with stimulation rather than background noise) and projected them in 3D against the wellbore trajectories. This gives a stage-by-stage view of where the fractures actually grew.

{{< iframe src="/posts/2025-09-06-utah-forge-april-stim-work/forge_3d_plot.html" >}}

The stimulation of 16A gives us very important findings here. Notice that for 16A, Stage 3, Stage 4, Stage 5 and Stage 6 events directly connect to the same plane, which sits between the perforation intervals of **16A-Stage-3 and 16B-Stage-1**. We believe this is the preferential flow path we speculated about earlier but couldn't confirm from DTS, since it falls within the damaged part of the fiber optic cable.

When you toggle all of these off and start from 16A's Stage 7, you see that it also connects to the same plane as before, but another cluster shoots away, going towards 16B's Stage 2. **We believe that this is the preferential flow path for 16B-Stage-2 we have seen in the DTS plot**. Similarly, from here onwards, Stage 8 connects to both of these planes, but shoots out even further as well, showing a 3rd plane, which very interestingly goes to 16B-Stage-4, and **we believe this is that second preferential flow path we observed at 16B-Stage-4 in the DTS plot**.

All in all, we have identified 3 preferential flow paths, which shows non-uniform characteristics and not desired in a typical EGS operation.

## Putting it all together

1. **Fractures were successfully generated in all stages.** The tracer test confirms connection between 16A and 16B, and the relationship between contribution and number of clusters per stage shows that the stimulation worked roughly as designed.
2. **Three flow paths dominate.** Combining DTS and microseismic data, the flow paths reached/enhanced by **16B-S1**, **16B-S2** and **16B-S4** are the dominant ones in the post-stimulation network. Our findings here are aligned with [Finnila et al. (2023)](https://pangea.stanford.edu/ERE/db/GeoConf/papers/SGW/2023/Finnila.pdf) and the 2024 DFN model release ([Finnila & Jones, 2024](https://gdr.openei.org/submissions/1646)), which also identified a few main fractures dominating the network.
3. **Stress shadow effect is prominent.** Once the dominant flow paths are established, they act as a "sink": surrounding fractures preferentially propagate *toward* them rather than into the surrounding rock. Finnila et al. (2023) showed this very nicely with their proposed DFN, where smaller fractures clearly bend toward the dominant ones.

![Obtained Fracture Network.](assets/posts/2025-09-06-utah-forge-april-stim-work/combined_fracture_network.png)

Why does this matter? Because dominant flow paths are great for proving that the well pair works, but in the long run, they create a problem: **thermal short-circuiting**. If most of the fluid keeps following the same few channels, the rock around those channels cools down quickly, the produced water temperature drops, and the project loses its thermal lifetime. Meanwhile, large volumes of hot rock between the dominant paths sit there essentially un-utilized.

This is the central tension we wanted to surface with our analysis: *the very thing that made the April test a success, strong, well-defined flow paths, is also a long-term liability if it isn't addressed.*

## So, what would we do next? A re-stimulation proposal

Given the picture above, the under-utilized rock volume between the dominant flow paths is exactly where a re-stimulation should be targeted. The goal would be to increase flow uniformity, improve EGS efficiency, and extend the thermal breakthrough lifetime.

Here is a sketch of what such a re-stimulation could look like:

- **Better diagnostics first.** Before any re-stim design, the obvious low-hanging fruit is to **catalogue the microseismic events for the 16B stimulation** properly. This would close the gap left by the missing post-April-15 catalogue and give a much sharper picture of the enhanced flow paths and their directions. We also recommend running a **Flow Scanner Imager test** (or a spinner log as a budget alternative). This would directly identify the dominant flow paths and validate (or challenge) our findings, particularly around S3R where the fiber dropped out.
- **Detailed perturbed-stress analysis.** The current stress state is no longer the original one, since the dominant fractures have re-arranged it. Quantifying this perturbed stress field is critical to designing a re-stim that *avoids* re-opening the dominant paths and instead targets the under-utilized rock between them.
- **Oriented perforation design.** Use oriented perforating techniques (e.g. XLET) with the perforation azimuth guided by the perturbed-stress analysis above. Cluster placement should aim for uniform treatment across the new stage.
- **Mechanical isolation of the target interval.** Straddle packers are a robust option for isolating the target zone from the existing dominant paths. As an alternative or complement, degradable particulate diverters can be used to push fluid into the desired direction.
- **High-viscosity, possibly pulsed, initiation.** A high-viscosity fluid pill, potentially combined with pulsed injection, would help initiate fractures in the under-stimulated zone where breaking new rock is harder than re-opening the existing dominant paths.
- **Transition to regular EGS fluid.** Once the new fracture is initiated, transition to the main EGS stimulation fluid for sustained propagation.

## Closing thoughts

It was a fun datathon, partly because of the topic, partly because the dataset is genuinely good. Working with public-data EGS projects like Utah FORGE makes you appreciate how much the field benefits when the data is *actually* shared. You can do real, opinionated analysis on the same footing as the operator's own teams, and people can argue about interpretations openly. (Compare this to the typical oil and gas situation where the most interesting datasets are locked behind proprietary databases, and you start to see how much faster the geothermal field could move with this kind of openness.)

Big thanks to [GEODE](https://www.geode.energy/) and [Project InnerSpace](https://projectinnerspace.org/) for organizing the datathon, and to my teammate [Emmanuel Ikpesu](https://www.linkedin.com/in/emmanuel-ikpesu/) for the long nights spent staring at DTS plots together.

## References

- Finnila, A., Damjanac, B., & Podgorney, R. (2023). *Development of a Discrete Fracture Network Model for Utah FORGE using Microseismic Data Collected During Stimulation of Well 16A(78)-32.* In 48th Workshop on Geothermal Reservoir Engineering, Stanford University, Stanford, California.
- Finnila, A., & Jones, C. (2024). *Utah FORGE 2024 Discrete Fracture Network Model Data* (No. 1646). USDOE Geothermal Data Repository (United States); Energy and Geoscience Institute at the University of Utah.
- England, K. (2024). *Utah FORGE: Wells 16A(78)-32 and 16B(78)-32 Stimulation Pressure and Circulation Data April, 2024.* [Data set]. Geothermal Data Repository. [https://doi.org/10.15121/2371032](https://doi.org/10.15121/2371032)
- McClure, M. et al. (2025). *Preliminary Analysis of Results from the Utah FORGE Project.* 50th Workshop on Geothermal Reservoir Engineering, Stanford University.
