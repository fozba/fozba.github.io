---
title: "Mapping Geothermal Potential with Data Analytics"
date: 2025-08-30T00:00:20+00:00
hero: /posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/pfa_favorability_map.png
theme: Toha
math: true
menu:
  sidebar:
    name: Mapping Geothermal Potential with Data Analytics
    identifier: 2025-08-30-mapping-geothermal-potential-with-data-analytics
    parent: 2025-posts
    weight: -4
---

## Summary

Recently, we joined the [2025 GEODE Datathon](https://www.geode.energy/news/geode-datathon-winners-announced) with a friend as a team of 2. The competition had two tracks: Engineering and Geosciences. We joined both of them and placed 2nd in both (2 people, 2 tracks, 2nd in 2 competitions - lot of 2s there 🤣). This post covers what we did for the Geosciences track.

The Nevada Play Fairway Analysis (PFA) is a landmark study by many geoscientists that compiles various data sources across the Great Basin, Nevada, to assess the geothermal potential of several locations of interest. Although I will elaborate on what the work is about below, the source files and the final report can be found [here](https://gdr.openei.org/submissions/756).

The challenge was to use the published data for any kind of data analytics: interpret the existing work and results, try to improve the data, try to come up with a new workflow ... anything. We decided to go with the last option. We treat the challenge as an image processing problem and develop a multi-channel Convolutional Neural Network to assess the geothermal potential across the basin pixel by pixel, where each pixel corresponds to a $50\text{m} \times 50\text{m}$ area on the ground.

## Nevada Play Fairway Analysis

The Nevada PFA project focuses on identifying *blind* geothermal systems - geothermal resources in Nevada's Great Basin that have no surface expression. No hot springs, no fumaroles, nothing to tip you off from the surface. Finding these systems requires integrating a large number of geological, geochemical, and geophysical datasets into a single spatial model of favorability.

The end product of the PFA is an overall favorability map: a continuous spatial score across the study area indicating how likely a given location is to host a viable geothermal system. This is a complex, expert-driven, multi-dataset synthesis, which is exactly the kind of problem that machine learning can bring value.

{{< figure src="/posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/pfa_favorability_map.png" caption="Overall favorability map of the Nevada PFA study (Faulds et al., 2015)." >}}

## Our Work

### The Idea

Rather than re-doing or re-interpreting the PFA, we wanted to *hitchhike* on it. The PFA favorability map becomes our response variable. In other words, we use the PFA favorability map as what the CNN learns to predict from the underlying spatial input features. Importantly, if the model can learn this relationship from one part of the map and generalize to another unseen part, that tells us something meaningful: the spatial patterns in the input features are genuinely informative, and the model may be able to identify high-favorability zones in areas the PFA did not flag.

### Feature Engineering

We used six input features, each representing a different physical property of the subsurface across the study area:

- **Geodetic strain**: Measures how fast the Earth's crust is deforming. High strain rates indicate active tectonics, which drives fault permeability and creates pathways for geothermal fluid circulation.
- **Horizontal gravity**: Variations in gravity reveal subsurface density contrasts, helping identify basin geometry and buried structures that control fluid flow.
- **Regional permeability**: A direct measure of how easily fluids can move through the rock. High permeability is a prerequisite for an economically viable geothermal system.
- **Temperature at 3 km depth**: The most direct indicator of geothermal potential — higher temperatures at accessible depths mean more energy to extract.
- **Earthquake density**: Seismic activity is a proxy for active faulting. Earthquakes cluster along permeable fault zones, which are also the preferred pathways for hydrothermal fluids.
- **Faults (500 m buffer)**: Faults are the primary conduits for geothermal fluids in the Great Basin. Proximity to a fault is one of the strongest predictors of geothermal activity.

Each feature becomes a separate channel in the CNN input, analogous to how a color image has R, G, and B channels. The fault layer required some preprocessing: raw fault data is too sparse (most of the map has no fault), so we computed the Euclidean distance to the nearest fault at every pixel, giving a continuous field across the entire map. Similarly, the raw PFA favorability map has sharp, discontinuous transitions caused by the human-defined zone boundaries. We applied focal statistics to smooth these out before using it as the response variable.

{{< figure src="/posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/preprocessing.png" caption="Left: raw and smoothed favorability. Right: raw fault lines and Euclidean distance to fault." >}}

### Methodology

We built a pixel-to-pixel regression CNN. For each location on the map, the model takes a $32 \times 32$ patch of the six input channels centered on that pixel and predicts the favorability score at the center. Patches are sampled with a 2-pixel sliding stride.

For train/test/validation splitting, we split the map geographically: the left half is used for training and testing, and the right half is held out entirely as the validation set. This is a deliberate and important choice: it forces the model to generalize spatially to an area it has never seen, rather than just memorizing local patterns.

One significant challenge was class imbalance. Most of the map has low favorability, so a naive model would simply predict low values everywhere and still achieve low MSE. To address this, we defined manual bins of favorability scores and oversampled from the high-favorability bins during training.

{{< figure src="/posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/resampling.png" caption="Favorability distribution before (top) and after (bottom) resampling. The resampled distribution better represents high-favorability areas, however, still not optimal." >}}

### Results

{{< iframe src="/posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/generated_map.html" >}}

The model converges in approximately 50 epochs. Patch-level predictions on the test set are visually coherent and closely match the true favorability patterns locally. The CNN predictions highly agree with the known training locations, validating its base physical accuracy.

The true value created, however, lies in the model's extrapolation. When evaluating the difference map, our network identified highly prospective new zones. These zones are **indicated by darker-red in the difference map above**, that were undervalued by standard linear methods, yet remain geologically highly promising due to their proximity to local faults and permeability corridors.

Beyond validating the PFA, the model surfaced some new areas of interest. In particular, the southern tips of several faults in the southeastern region of the study area were flagged as highly favorable. These areas that were not prominently highlighted in the original PFA. This is the kind of result that is genuinely useful, where our work point to places worth a closer look, that PFA did not.

{{< figure src="/posts/2025-08-30-mapping-geothermal-potential-with-data-analytics/insights.png" caption="Right half of the study area, where the fields marked with yellow are the fields obtained by PFA and the coloring represents our CNN's favorability (left). As it could be seen, our model correctly identifies many of the high-potential fields identified by PFA, and disagrees with some of them, such as the circled region at the center of the map. On the other hand, our model identifies an area with significant favorability on the southeast. When we zoom onto that section (right), we see that the southern tips of the faults in this region are particularly favorable by our model while overlooked by PFA work." >}}

### What We Would Do Next

The hackathon format meant many ideas were left on the table. The ones we would explore first:

- **Better resampling**: Our manual binning approach is a reasonable starting point, but a more principled strategy for handling the class imbalance could improve results.
- **Fault density instead of Euclidean distance**: A density-based representation may better capture the structural complexity of fault networks.
- **Alternative features**: DEM (digital elevation model) and other predictor features could be informative and are worth testing.
- **Alternative response features**: The smoothed PFA favorability is a reasonable target, but ultimately, one would want to train such a model based only on data and involve no human-interpretation for repeatability in other fields.

Shootout to my teammate, [Emmanuel Ikpesu](https://www.linkedin.com/in/emmanuel-ikpesu/) for all the hard work.

## References

- Faulds, J., Hinz, N., dePolo, C., Hammond, W. et al. (2015). *Nevada Great Basin Play Fairway Analysis*. Geothermal Data Repository. [https://gdr.openei.org/submissions/756](https://gdr.openei.org/submissions/756)
- Smith, C. M., Faulds, J. E., Brown, S., Coolbaugh, M. et al. (2023). Exploratory analysis of machine learning techniques in the Nevada geothermal play fairway analysis. *Geothermics*, 111, 102693.





