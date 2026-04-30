---
title: "Some Reviews about Energy Engineering - Part 1"
date: 2025-03-29T00:00:20+00:00
hero: /posts/2025-03-29-somereviews/hero_energy_review.png
theme: Toha
math: true
menu:
  sidebar:
    name: Some Reviews about Energy Engineering - Part 1
    identifier: 2025-03-29-somereviews
    parent: 2025-posts
    weight: -2
---

Last semester, I have enrolled in Energy and Environment class. It was great, because it reminded me that I should know all about energy in a much more general sense than just focusing on the technical aspect of producing petroleum or geothermal energy: Energy engineering is much more than that, it is about knowing the market, the demands and the trends. For this purpose, there is *a lot* to learn. **A lot**!

So, I thought to myself: I am keeping a blog, and I want to add things to my blog, and I want to learn more about energy engineering. So, why not documenting what I know and learn here? Wonderful!

## Resources and Metrics

When it comes to understand energy engineering, there are many, many sources. The first thing is to identify what sources to check in general

### Our World in Data

[Our World in Data](https://ourworldindata.org/) is a webpage that is essentially an amazing compilation of different types of data, curated across vast different sources in a very good, meticulous way. The way the data is organized and presented offers a great start point for digging into the trends in world. For example, here is the chart for global primary energy consumption by source for each year:


#### Primary Energy Consumption

<iframe src="https://ourworldindata.org/grapher/global-energy-substitution?tab=chart" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>

> Primary energy consumption refers to the total amount of energy used by a country, region, or sector before any transformation or conversion into secondary energy sources (such as electricity or refined fuels). It includes all raw energy sources extracted or harvested directly from the environment.

Couple of points could be made looking at this plot without diverging from the general survey-esque aspect of this post:

- The growth in the primary energy consumed seems to be exponential.
- After 2001, there is a significant increasing trend in fossil fuels, dominated by coal.

This beautiful webpage offers us some other plots as well:

<iframe src="https://ourworldindata.org/grapher/primary-energy-cons?tab=chart&country=USA~OWID_EU27~CHN~IND~BRA" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>

Before talking about the interpretations from this plot, I want to talk about why I have especially selected these countries: When you are reviewing things about the energy, there are certain countries&groups that essentially form their own categories/classes, and when you review the rest of the world, you usually want to put them in either of these groups:

- US & EU: Developed Countries
- China & India: These are Developing Countries, but most of the time separated from the other developing countries because of their exceptional production output and population. Especially China is important in this sense
- Developing Countries: Brazil, Indonesia, South Africa, Turkey, Argentina etc.
- Emerging Countries: Vietnam, Egypt, Philippines, Nigeria etc.
- Underdeveloped Countries: Haiti, Chad, DR Congo etc.

These groups are very prominent when you review any data related to energy. For instance, as you can see the plot above, the developed countries like US and EU countries have a rather "stable" primary energy consumption plots: They have developed and matured their energy infrastructure, so the increasing trend has stopped. You can validate this by checking between 1965-1975 and you would see also an "increasing trend" for these countries as well, which comes to a stop after these dates. In these plots, I usually dont include after Developing Countries, because simply the y-axis range created by the Developed countries overwhelm the rather low values for these countries, and the visual inspection becomes kinda obsolete. In these cases, either view them separately or use log-scale.

I normally don't *primarily* care about the GDP of these countries, but their GDP and some other factors are actually strongly correlates with this distinctions. In other words, you can separate these countries based on other metrics. One very noticeable metric from the energy perspective is **Energy Consumption Per Capita**:

#### Energy Consumption Per Capita
<iframe src="https://ourworldindata.org/grapher/per-capita-energy-use?tab=chart&country=IND~USA~CHN~OWID_EU27~BRA" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>

Energy Consumption Per Capita is an amazing indicator of the development of that individual country: As you can see, although India has a much larger primary energy consumption than Brazil, which is a significant consumer in the Developing Countries group, when it comes to Energy Consumption Per Capita, India is severely under Brazil. For 2023: Brazil had the energy consumption per capita of 17806 kWh, where the number is 7586 kWh (by the way, if you wonder what the heck these numbers mean anyway, you can [check the appendix](#appendix-numbers-mason-what-do-they-mean)). Even for China, the amount is lower than Brazil until 2003. Therefore, although gross energy consumption of the country can tell us how big of a player that country is, in the global energy market, the development of the country and the establishment of the welfare could be measured much better with energy consumption per capita.

Still, checking all these three plots above, there is something very obvious:

- China started to develop rapidly after 2001.

So, without any kind of other source or historical knowledge, just by looking at these plots, we observe that 2001 (or the years around 2001) was a significant year for China. And if we Google this (or ask GPT if we are lazy - like me):

> China's rapid energy consumption and production growth after 2001 can be attributed to several key factors:
> 
> **Entry into the World Trade Organization (WTO) (2001)**
> 
> - China joined the **WTO in December 2001**, leading to a massive expansion in trade, industrial output, and infrastructure development.
> - Exports surged as China became the **"world’s factory,"** increasing energy demand, especially for:
>   - **Manufacturing**
>   - **Transportation**

So, the beauty of energy engineering is that the data actually *tells* something. And this was a quick demo for Our World in Data webpage.

Before moving further, for the people interested, a significant metric to measure the development is [Human Development Index](https://hdr.undp.org/data-center/human-development-index#/indicies/HDI). From the link (and GPT for an expanded explanation on calculation):

> The Human Development Index (HDI) is a summary measure of average achievement in key dimensions of human development: a long and healthy life, being knowledgeable and having a decent standard of living. The HDI is the geometric mean of normalized indices for each of the three dimensions.
> HDI is calculated based on three key dimensions:
> 
> - **Life Expectancy at Birth** → Represents the **health and longevity** of a population.
> - **Education Index** → Measures access to knowledge, based on:
>   - **Mean years of schooling** (average years of education received by adults)
>   - **Expected years of schooling** (years a child entering school can expect to complete)
> - **Gross National Income (GNI) per Capita** → Reflects **standard of living**, adjusted for purchasing power parity (PPP).

<iframe src="https://ourworldindata.org/grapher/human-development-index?tab=chart" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"></iframe>

Now, I also sometimes dig into data roughly, to get some ideas and take notes for the future. Since the global primary energy consumption curve looked exponential to me, I tried to fit an exponential curve:

{{< iframe src="/posts/2025-03-29-somereviews/energy_fit.html" >}}

This fit says the annual growth rate is $1.85\\%$, but here, I realized that the early points (especially the ones around 1800s) are highly rough, uncertain and sparse. We would like to *weight* the later points in our work to get a more accurate fit (of course, fitting an exponential curve is a serious business, and the accuracy of this fit would be up to discussion as well):

{{< iframe src="/posts/2025-03-29-somereviews/energy_fit_weighted.html" >}}

And this fits says the annual growth rate is $2.07\\%$. So, roughly we can say that these plots *may* indicate an annual growth of $2\\%$. This is good, but just looking at the whole data and fitting an exponential curve is a very, VERY crude business. First of all, not all countries are going to contribute to growth with the same *pace*. As we have seen from the plots above, developed countries are pretty much stagnant in their energy consumption. Also, there are exceptional players like China, whose growth rate is going to be significantly different than other players. Also, the policies for reducing $\text{CO}_{2}$ emissions are pretty mainstream now, with the other motivators like [Energy Tax Credit](https://tax.thomsonreuters.com/blog/renewable-energy-tax-credits-geothermal-solar-biomass-wind-power-and-more/) that promote renewables and green alternatives for both household and industrial scenarios. All in all, there are many different factors and key considerations when doing such a calculation.

*Yes, but then how these calculations/estimations are made* 

For that, we proceed to our next source:

## Energy Agencies and Reports

There are several key Energy Agencies in the world, who do not just provide data like Our World in Data about pretty much anything, but instead have a special focus on the global energy market. These agencies also publish annual reports that are extremely informative and are a must-read for an energy engineer. These agencies are:

**1. International Energy Agency (IEA)**  
[https://www.iea.org](https://www.iea.org)  
A global organization that provides data, policy recommendations, and research on energy security, sustainability, and efficiency.

**2. U.S. Energy Information Administration (EIA)**  
[https://www.eia.gov](https://www.eia.gov)  
The statistical and analytical agency of the U.S. Department of Energy, offering extensive data on energy production, consumption, and trends.

**3. International Renewable Energy Agency (IRENA)**  
[https://www.irena.org](https://www.irena.org)  
A global agency that promotes renewable energy adoption and sustainable energy transitions.

**4. World Energy Council (WEC)**  
[https://www.worldenergy.org](https://www.worldenergy.org)  
A global forum that provides strategic insights and leadership on energy issues across all sectors.

**5. European Environment Agency (EEA) - Energy Section**  
[https://www.eea.europa.eu/themes/energy](https://www.eea.europa.eu/themes/energy)  
An agency of the European Union that provides independent information on energy, climate, and environmental policies.

**6. International Atomic Energy Agency (IAEA) - Energy Section**  
[https://www.iaea.org/topics/energy](https://www.iaea.org/topics/energy)  
A United Nations organization that supports nuclear energy development and safety.

Among these, IEA, EIA and IRENA provides most important reports, with IAEA being a very good institution if you especially want to follow the developments in Nuclear Energy

For the rest, I need to take a rest!

![Under Construction](/images/under_construction_1.png)



## Appendix: Numbers Mason, what do they mean?

When people talk about energy, they throw out all these fancy words like kWh, MWh, GWh, BTU, Quads... *What are even those things?!* This is what I firstly asked myself when I study about energy. Because, yes, I mean, you see the numbers, and they offer you a way of comparing stuff per se, but what is the point if I dont even know what that number means?

**1 Joule** : The fundamental SI unit of energy. To give you a sense of scale: lifting a small apple (roughly 100 grams) one meter off the ground requires about 1 Joule of energy. Not a lot! In fact, it is such a small unit that in practice, we almost never use it directly for energy reporting. Mostly, we use kWh, MWh and so on. However, it is the base unit that everything else builds on. It is still important to keep in mind to bridge all the values altogether.

### Rates

#### SI Units

**1 Watt** : The energy output _rate_ of 1 Joule per second. This rate differentiation is very fundamental and it should be kept in mind. When the industry reports energy output, it is either in rate format (kW, MW...), or in _total energy output_ format (kWh and MWh).

**60 Watt:** Energy rate required to run one standard lightbulb.

**1 kW**: 1000 Watt. Pretty straight-forward.

**1.2 kW:** Average energy consumption rate of a US household. Again, this means, you need a constant energy output of 1.2 kW to support one household (Of course, in real life, the inter-daily consumption will vary, for instance, people will turn of most of the appliances at night, so this rate assumes average consumption throughout the day. **This is exactly why consumed energy is usually reported as the total output**).

**1 MW**: 1000 kW.

### Total Output

**1 kWh:** 1 Kilowatt-hour: This is the most common unit used for the reports (for small/commercial scale). It means _total energy obtained by running a 1 kW energy source for 1 hour_. 

**10000 kWh:** Average annual household energy consumption (in an energy-rich country like the US).

#### Imperial Units

If you are a US-based enthusiast, you will sometimes see things like BTU and Quad. Knowing these is very important as well.

**1 BTU (British Thermal Unit):** The amount of energy required to raise the temperature of 1 pound of water by 1°F. It is roughly equal to 1055 Joules, or about the energy released by burning a single match. Not a lot!

**1 MMBTU:** 1 Million BTU. This is where things get interesting for the industry: natural gas is typically traded and reported in MMBTU. For reference, 1 MMBTU ≈ 293 kWh.

**1 Quad:** 1 Quadrillion BTU ($10^{15}$ BTU). This is the big boy used when talking about national or global energy consumption. For reference, the US consumes roughly 100 Quads of energy per year. When you see IEA or EIA reports throwing around numbers in Quads, this is what they mean.

#### Other Units You Will Encounter

**1 toe (tonne of oil equivalent):** The amount of energy released by burning one tonne of crude oil, roughly 41.87 GJ or about 11,630 kWh. This is a very common unit in IEA reports. You will also see **Mtoe** (million tonnes of oil equivalent) and **Gtoe** (billion tonnes of oil equivalent) for larger scales.

**1 boe (barrel of oil equivalent):** Similar idea, but normalized to one barrel of oil instead of one tonne. 1 boe ≈ 6.1 GJ ≈ 1700 kWh. Very common in petroleum engineering contexts.

### Putting It All Together

So, when you see something like *"Brazil had the energy consumption per capita of 17806 kWh"*, you can now put that in context: running a single 100W lightbulb continuously for a year consumes about 876 kWh; so 17806 kWh is roughly equivalent to keeping 20 such lightbulbs on, non-stop, for an entire year, per person. And when you see *"global primary energy consumption is around 580 EJ"*, you know that is $580 \times 10^{18}$ Joules, which is an absolutely staggering number, and why energy engineering is such a big deal.

The key takeaway is: **always check the units**. The energy industry is notorious for mixing SI and imperial units depending on the context, the country, and the sector. A number without a unit is meaningless, and a number with the wrong unit interpretation can be wildly misleading.