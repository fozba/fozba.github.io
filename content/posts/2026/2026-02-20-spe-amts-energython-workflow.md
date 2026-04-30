---
title: "SPE AMTS Datathon Workflow"
date: 2026-02-20T00:00:00+00:00
hero: /posts/2026-02-20-spe-amts-energython-workflow/hero_energython.png
theme: Toha
math: true
menu:
  sidebar:
    name: SPE AMTS Datathon Workflow
    identifier: 2026-02-20-spe-amts-energython-workflow
    parent: 2026-posts
    weight: -100
---

_If you are just skimming the blog for my projects, you can jump to [here](#blog-special-interactive-model) for an interactive demo of this work._

A couple of months ago, I have seen a VERY interesting competition going on: [SPE AMTS Energython](https://jpt.spe.org/spe-asset-management-technical-section-to-host-energy-economics-symposium). This competition was about designing a gas power plant to power a 10-20 MW datacenter from ground up, calculate things like CAPEX, OPEX, NPV etc., and present it to a group of judges to "sell" your ideas - pretty much like a "Shark Tank". Importantly, this was a US-wide competition, and the first 2 winning teams were said to be going to compete in the global competition afterwards, in October. 

As a person who is super interested in becoming an energy systems engineer, I find value in immersing myself in such work, because when you are a Petroleum Engineer BEng, MSc and PhD, it can be really hard to get an exposure to such concepts, and it is **really** important to get that exposure. Besides, data centers are of utmost importance for the latest increase in the energy demand: So, in order to understand how the energy ecosystem will be shaped in the next decade, knowing about these guys should help a lot.

This competition required a team of 3-5 people, but at that time I didn't have a team in mind and the deadline was approaching, so I decided to try my chances by joining alone, establishing the hypothetical company "Sierra Solutions" (the header image is from my pitch deck for the company, I loved the logo).

## What the competition was about

Essentially, the teams were supposed to choose one of the locations below, to construct a gas power plant that should yield a net output between 10 and 20 MW:

- Ashburn, VA 
- Dallas, TX 
- Wichita, KS
- _not specified_, LA 
- Seattle, WA
- Chicago, IL
- Philadephia, PA

After you select your site (and possibly justifying why), you are to determine and calculate things like, what kind of turbine you are using, how many turbines you are using, how much land you need etc. Of course, these are all conceptual, meaning that a team can calculate these or skip these, based on how deep they want to go. In the end, however, you are supposed to have some kind of financial result (how much profit you expect to make), because after all, this is a "Shark Tank Pitch" competition, and you are supposed to "sell" your idea to sharks.

For me, it was a great opportunity to get as deep as possible as a one-person team in only 3 days (because that is how long the deadline was ahead by the time I joined, uh-oh): If I lose, I still learn as many things as possible about energy systems for data centers. If I win, it is icing on the cake, on top of learning all that stuff.

## My procedure

Since this is going to be a gas power plant, the first thing I did was to check natural gas [spot prices](https://naturalgasintel.com/glossary/spot-price/). EIA is a great source for this.

<center>{{< img src="/posts/2026-02-20-spe-amts-energython-workflow/spot_prices.svg" align="img-center" >}}</center>

Here, two things immediately caught my attention:

- Northeastern hubs have incredibly long tails, compared to others. This suggested to me that there are regular congestions in gas flow.
- Waha Hub has a mean spot price of nearly <span>$0</span>, with values sometimes reaching negative values.

Since we are building a gas power plant, connecting to Waha Hub would make so much sense: It would allow us to tap into that cheap gas, which would already provide a significant advantage to other teams in the competition - something I can promote to those hungry sharks with a confidence.

But, do any of these regions get its gas from Waha? Because Waha is in West Texas, which also explains the cheap gas since you would expect having surplus in Permian from time to time. Maybe some of you will remember the [negative oil prices in 2020](https://www.eia.gov/todayinenergy/detail.php?id=46336)? Turning back to the point, I checked if any of these regions actually get its gas from Waha, and I found something very plausible.

## Hugh-Brinson Pipeline

Turns out, there was an ongoing pipeline project called the [Hugh Brinson Pipeline](https://hughbrinsonpipeline.com/) That aims to bring Waha gas to Maypearl, TX. So here, I can do a bit of a cheeky assumption and place my project around Red Oak, which is just next to Dallas and should still be in the acceptable project area. Because, after the gas reaches here, it will be distributed by the trunk lines, which goes in Red Oak and also Dallas, so it should not be super important for a competition.

If my idea makes sense, I should expect to see some new data centers being built in this area, because if an idea is plausible, market is mature to have already picked it up. So I checked the data centers at that region... and jackpot.

<center>{{< img src="/posts/2026-02-20-spe-amts-energython-workflow/dallas_data_centers.png" align="img-center" >}}</center>

Turns out, Red Oak and areas nearby has many data centers, including a Google Campus, so this is indeed a good place to build these.

## Trunk Lines

You don't get the gas from these big pipelines. You get them from the pipelines that belongs to energy transmission companies. So, I just choose an arbitrary location in the map that is close to the major transmission pipelines on the map, and boom - that's my project site.

<center>{{< img src="/posts/2026-02-20-spe-amts-energython-workflow/project_map.png" align="img-center" >}}</center>

## The Grid

Then, I thought, "This thing must connect to the grid.", which led me to the research about how long does that take, and I discovered something VERY important, which is a key thing that finds its place to every conversation in the industry: [grid connection queue](https://emp.lbl.gov/queues). Turns out, power plants that want to connect to the grid, has to wait a queue, and this queue is ever-increasing because of the boom in the energy demand (and supply). Turns out, a great fraction of the current debate related to the energy is revolving around the grid and the grid-related issues, where the queue being one of them.

So I thought: This is a competition, so they will want to see innovative solutions (even if they are not industry-level realistic). So, why not **bypass** the grid entirely, and make it the "motto" of my project? After all, any investment that will rely on the grid connection has to delay profits by that queue, which is by the way, around 3 to 5 years. My project can deliver a very fast [Commercial Operations Date (COD)](https://uk.practicallaw.thomsonreuters.com/w-001-7697?transitionType=Default&contextData=(sc.Default)&firstPage=true) compared to the other projects that will wait for a grid queue.

But, since this power plant is going to power a data center, I need to make sure of two things:
- Net delivered power will almost never go low/off.
- The required gas for delivering this power will almost always be delivered without a problem.

So, if we make these work, we actually do have a project.

## The Turbines

When you build a gas power plant, maybe the most important thing is to convert that gas into power (No sh*t, Sherlock). For our project, we need to make sure our turbine/engine configuration fits our criteria:

- We want to generate 10-20 MW net power.
- We want the generation to be never interrupted.

Matter of fact is that during the competition finals (spoiler alert, I made it to the finals), I have seen some teams actually tried to use large, conventional turbines. However, there are 3 major problems regarding these, which completely invalidates the possibility of using them:

- You can't order these on Amazon. These are built by order, and it takes **years** to deliver them. You can't convince any investor for a project that waits on an equipment for two years.
- You can't *meaningfully* produce 10-20 MW with these. Many of these turbines are designed for very high power outputs. Which means that for low power production, they will operate significantly below their peak efficiency, ending up burning so much fuel for the same power production that you would get from a smaller turbine, which has a peak power production closer to 10-20 MW. Nonetheless, you still have some alternatives for these ranges, so this is still doable. But, most importantly:
- You can't start these fast. Turbines work on a principle that we refer to as [combined cycle gas](https://www.power-eng.com/gas/turbines/turbines-vs-reciprocating-engines/), which shortly means (here, I say shortly to look cool, but deep down I am also not very knowledgeable, please pretend that I know what I am talking about and proceed) that these turbines take upto an hour to deliver full power. When you need to stop one of the engines, you have to wait quite a bit, which data center operators won't like at all.

This lead me to this other kind of gas power generators, that are called [Reciprocating Engines](https://www.power-eng.com/gas/turbines/reciprocating-engine-generator-technology/). These are designed to deliver peak-power for all the operating time, which is why, they are used in [Peaking Power Plants](https://en.wikipedia.org/wiki/Peaking_power_plant), which are the power plants that are run when there is a high demand in power (and the grid can't sustain it), so that they can give the extra power that the grid needs. **The tradeoff?** Combined cycle gas is much more efficient than this. So, this was the Achilles' Heel for my project: I am using a less efficient way of generating gas power, but in the end, my financials will be compared to the more efficient producers on the market. But this is still plausible if we can offer uninterrupted & reliable power, since the prices of the combined cycle gas will reflect the gas power that is purchased as electricity from the grid, which are suscepted to the problems mentioned above.

So, I need to make sure that power generation is never interrupted.

## Redundancy

A very important concept in data centers is that you can't have "just enough" turbines to generate power. What if one of them gets broken? Training stops, inference stops, operation stops, everything stops. Worse, if the data center was, let's say, training a model, everything since the latest checkpoint is gone. If they were trading, the trading has stopped. No data center can afford that.

To prevent this, operators provide _spare, redundant components_ over the N components needed for the full load. For instance, if you need 10 turbines or engines, you would build 11 of them instead, which is basically named as "N+1" configuration, so if one of your engines go bad, you can switch to the other one.

There are different configurations available, such as N configuration, N+1 configuration, N+2 configuration and 2N configuration, and so on. These are classified into tiers:
- Tier 1 - N
- Tier 2 - N+1 partial, see full explanation [here]()
- Tier 3 - N+2 (normally, tier 3 is also N+1, but based on the definition of the tiers, it is here for our work)
- Tier 4- 2N

Since we are building a 10-20 MW power plant for a data center, our client will not be a super giant. Therefore, we want to have the sweet balance of providing the right amount of redundancy and not overspending. Most of the data centers in the world are Tier 3, so, when I was choosing the turbine/engine and the configuration, I paid a special attention to N+2 configurations.

I scraped the web for turbine prices and efficiencies, and I was able to come up with some numbers for some promising candidates.

<iframe src="/posts/2026-02-20-spe-amts-energython-workflow/equipment_tables.html" width="100%" style="border:none;" scrolling="no" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 15) + 'px';"></iframe>

Here, Titan 130 was a combined cycle gas turbine, and was eliminated due to the reasons I mentioned above. Wartsila 31 SG was the most efficient turbine, but it was very costly, so if you needed redundancy, even for N+1 configuration, the CAPEX would go around <span>$53M</span>, which rendered it impossible. The modular, cheap Caterpillar G3520H was by far the most reasonable choice for this work. Besides, it allowed an N+2 configuration for a reasonable price of <span>$15.53M</span>. Lastly, since it is a small, modular engine, you can order them very fast (not from Amazon, though).

As mentioned, the tradeoff is that these engines are not as efficient as CCG turbines or the alternatives like Wartsila's engines. But for 10-20MW power production, and for the sake of the depth of this project, I stopped my work regarding turbines here, thinking that at least this is defensible. But if you are reading this and you have things to teach me, I'd be more than happy to listen. Send me a message through my socials on the main page, you are much encouraged!

## CAPEX

You need to have a solid idea about how much money you are going to spend. I thought that many of the works presented will be more conceptual, and if I can put a detailed work here, it should give me an edge. That is why, I did my homework and learned what one needs to build a data center. These essentially boil down to:

- Turbines/engines, and the associated parts for emissions etc.
- Electrical [BOP](https://en.wikipedia.org/wiki/Balance_of_plant), where BOP is a fancy word meaning "everything supplies this branch of the work"
- Mechanical BOP
- Civil & Site works
- Soft Costs (these are you pay for these things to be brought together, including some extra 5% of what you have spent so far, to have some reserve money if something goes wrong. This is called [Contingency](https://www.procore.com/library/construction-contingency).)

After I bring these together, I ended up around a whopping ~<span>$31M</span> CAPEX:

<iframe src="/posts/2026-02-20-spe-amts-energython-workflow/project_cost_table.html" width="100%" style="border:none;" scrolling="no" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 15) + 'px';"></iframe>

## Rates

Now that we know how much we need to spend, we need to make money from this power plant. I come up with a 2-part tariff, where I charge for both the capacity rate (for each kilo-watt power I "promise to uninterruptedly provide" per month), and the energy rate (for each kilo-watt-hour energy I will deliver). My capacity rate is <span>$22.50 / kW-mo</span> and my energy rate is <span>$0.055 / kWh</span>. With my net power generation etc., these will turn out to a total, blended rate of <span>$0.086 / kWh</span>, or in other words, **8.6 cents per kWh**. The average gas-to-grid price (as discussed, combined cycle gas generators produce power directly to the grid and you buy the energy from the grid) in Dallas as of this competition, was 7.3 cents per kWh, so my energy is 1.3 cents per kWh more expensive, fluctuating between 4-9 cents per kWh. Therefore, even though my energy is more expensive, it is still within the gas-to-grid averages (not overly expensive), and comes with a guarantee of no interruptions (grid power is interrupted). I crossed my fingers that this is not too unreasonable and holds during the sharks trying to obliterate me.

But, how did I come up with these rates to begin with? That will make more sense once I finalize the work in the next paragraph.

## Financial Model

Even if my numbers were wild, I thought that a good financial model will prove that I put the effort and crunch the numbers. More importantly, it is the most important thing to understand how all of these are turned into financial talk. Even more, maybe if I can build a good financial model, it would give me an opportunity to see at what phase of my planning I get unreasonable values. In other words, I could back-track my work to find where it explodes, and fix that part.

To figure out if this project is a gold mine or a money pit, I built a comprehensive financial model over an 18-year project lifespan (accounting for around 1.5 years of construction and a 15-year debt term). The core logic boils down to calculating the [Levered Free Cash Flow (LFCF)](https://www.wallstreetprep.com/knowledge/levered-free-cash-flow/) for each year.

First, we calculate the incoming cash. Because of my 2-part tariff, the revenue is split into two streams. We also apply a small annual escalator because, well, inflation is a thing:

$$ Total Revenue = Revenue_{Capacity} + Revenue_{Energy} $$

Where:
- $Revenue_{Capacity} = MW_{Delivered} \times 1000 \times Capacity Rate \times 12 \times Escalator^{year}$
- $Revenue_{Energy} = MWh_{Generated} \times 1000 \times Energy Rate \times Escalator^{year}$

Next, we have to pay the bills ([OPEX](https://en.wikipedia.org/wiki/Operating_expense)). The undisputed heavyweight champion of our expenses is the fuel cost. Since I built the project around getting cheap gas from Waha, I set up the model to calculate a weighted gas price between the Waha Hub and the Henry Hub (just in case we need to source standard-priced gas as a backup). The fuel cost is dictated by the engine's "Heat Rate" (how much fuel it burns to make a MWh of energy) and an annual degradation factor, because engines get less efficient as they age. Lastly, we incorporate a "premium" for every MMBTU of gas we get, to ensure that we get our gas no matter what, which adds another layer of safety to our operational consistency.

Add in the variable O&M, staffing, insurance, admin, and property taxes, and we get our [EBITDA](https://en.wikipedia.org/wiki/Earnings_before_interest,_taxes,_depreciation_and_amortization) (Earnings Before Interest, Taxes, Depreciation, and Amortization). This is basically a fancy finance term for "the raw cash your project makes before the bank and the government take their cuts":

$$ EBITDA = Total Revenue - (Fuel + O\\&M + Staff + Insurance + Admin + Taxes_{Property}) $$

Before we figure out what we actually take home, we have to deal with the government and the bank. First, the taxman cometh. However, the US government highly incentivizes energy projects. By applying a 5-Year [MACRS](https://en.wikipedia.org/wiki/MACRS) (Modified Accelerated Cost Recovery System) depreciation schedule (which is essentially a legal mechanism where the government lets you pretend your equipment loses its value super fast) we can front-load our depreciation deductions. This creates a massive tax shield right when we need the cash the most. 

Next, we are borrowing a significant chunk of the <span>$31M</span> CAPEX to build this thing, meaning we have a loan to pay back (principal + interest). This brings us to a metric that lenders obsess over: the [Debt Service Coverage Ratio](https://en.wikipedia.org/wiki/Debt_service_coverage_ratio) (DSCR). Mathematically, it is calculated by taking the cash you have available to pay the debt (your EBITDA minus any income taxes paid) and dividing it by your total debt payment for that year:

$$ DSCR = \frac{EBITDA - Tax Paid}{Debt Service} $$

In crude terms, this is the bank's "comfort cushion." It measures how many times over you can pay your loan obligations using your available cash. If your DSCR is 1.5x, it means you are making $1.50 for every $1.00 you owe the bank that year. If that number gets too close to 1.0x, the sharks will smell blood and won't fund your project. A typical good DSCR is where it is greater than 1.42x.

Finally, subtracting our debt service and income taxes from EBITDA leaves us with the true metric investors care about, the Levered Free Cash Flow. Think of LFCF as the actual, literal cash left in your pocket at the end of the year after absolutely everyone (including the bank) has been paid:

$$ LFCF = EBITDA - Tax Paid - Debt Service $$

By discounting these cash flows back to year zero at a standard 12% [hurdle rate](https://en.wikipedia.org/wiki/Minimum_acceptable_rate_of_return), the model spits out our [Net Present Value (NPV)](https://en.wikipedia.org/wiki/Net_present_value) and our [Internal Rate of Return (IRR)](https://en.wikipedia.org/wiki/Internal_rate_of_return). Simply put, NPV tells you how much total profit the project makes in *today's* dollars (because a dollar today is worth more than a dollar in 10 years), and IRR is basically the equivalent annual interest rate this project pays you, like a supercharged savings account. If the IRR is healthy, the sharks will smile.

Doing this in excel & python yields a models where you can modify the parameters completely (except the greyed-out parameters):

<iframe src="/posts/2026-02-20-spe-amts-energython-workflow/finance_model_table.html" width="100%" style="border:none;" scrolling="no" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 15) + 'px';"></iframe>

And does the following calculations:

<iframe src="/posts/2026-02-20-spe-amts-energython-workflow/financial_projections_table.html" width="100%" style="border:none;" scrolling="no" onload="this.style.height = (this.contentWindow.document.documentElement.scrollHeight + 15) + 'px';"></iframe>

### Blog-special: Interactive Model
I actually implemented the entire model also in javascript & html so that it can be run from here as well.

{{< iframe src="/posts/2026-02-20-spe-amts-energython-workflow/sierra_model.html" >}}

## What if I am wrong? (Sensitivity Analysis)

Here is a universal truth about engineering and finance: **Your base case is always wrong.** 

Things rarely go exactly as planned. What if the construction takes longer? What if the Waha gas prices spike? What if our engines burn slightly more gas than Caterpillar promised? If you are going to pitch to a room full of experts, you need to show them you understand your project's vulnerabilities.

To do this, I set up a Sensitivity Analysis (often visualized as a Tornado Chart). I tweaked my most critical assumptions by $\pm 15\%$ to $25\%$ and let the model recalculate the IRR to see which variable swings the profitability the most.

{{< iframe src="/posts/2026-02-20-spe-amts-energython-workflow/tornado_chart.html" >}}

Unsurprisingly, the Energy Rate and Total CAPEX are massive drivers of the project's success. But importantly, because we locked into highly efficient, modular engines and sourced historically cheap gas, even our "worst-case" swings on things like Interest Rates or Heat Rates didn't outright kill the project. It proved the model was resilient. Though, the down-side from Energy Rate, with an IRR of 6.3%, shows that we can't charge cheaper easily.

## Rolling the Dice: Monte Carlo Simulation

Showing a $\pm 20\%$ swing on a chart is great, but in the real world, bad things happen simultaneously. What if construction is delayed *AND* gas prices spike *AND* CAPEX goes over budget? 

To give the sharks absolute confidence, I took the model one step further and ran a Monte Carlo Simulation. I assigned probability distributions (bell curves) to my assumptions. Then, I had the model "roll the dice" and recalculate the entire 18-year financial lifespan 10,000 times. Below is the distributions for the 4 most-important parameters' from the tornado chart (I ran this with ALL parameters in the real work):

{{< iframe src="/posts/2026-02-20-spe-amts-energython-workflow/assumption_portfolio.html" >}}

Instead of a single, rigid IRR number, this simulation gave me a Probability Distribution of Success. In the industry, we look at three main metrics from this curve:
- **P90 (The Downside Floor):** 90% of the time, the project will achieve at least this IRR. This is the "safe" number.
- **P50 (The Median):** The risk-adjusted, most likely outcome.
- **P10 (The Upside):** If the stars align, 10% of the time you hit this jackpot number.

{{< iframe src="/posts/2026-02-20-spe-amts-energython-workflow/monte_carlo_bell_curve.html" >}}

Having these stochastic numbers completely changes the tone of the pitch. Instead of saying, "Here is what I think will happen," you get to say, "Even if the market works against us, 90% of the time our returns will not drop below our P90 threshold." That is exactly what an investor wants to hear. 

Furthermore, when I built this model, I assumed the gas premium price of <span>$0.06</span> per MMBTU, and Waha Gas to be <span>$1.50</span>, while in reality both of these values should be very close to <span>$0</span>. You can set Waha gas to <span>$0.25</span> and see what happens for yourself 🙂 (spoiler alert: Our DSCR will skyrocket as well, so you can also increase the Debt Fraction to have a better IRR for the investors while still staying above 1.6x-1.7x DSCR). Even just this kind of modifications for my business model taught me the relationship between these values well, so it was a great learning experience overall!

## Final Thoughts

Building a 10-20 MW power plant concept from scratch, bypassing the grid, selecting N+2 redundancy reciprocating engines, and wrapping it all in a 10,000-iteration stochastic financial model in just 3 days was... exhausting. But man, was it worth it.

It forced me to bridge the gap between engineering reality and financial viability. You can design the most beautiful, efficient power plant in the world, but if the MACRS depreciation and debt amortization don't result in a positive LFCF, it's just an expensive piece of modern art.

I already gave a spoiler of making it to the finals, but what I didn't share this far (if you made it this far, many thanks for reading, and please feel free to reach if you want to talk about this work in any way) is that **I actually earned the 2nd place** for this work. Of course, if you come here from the "Projects" section in my main page, you have seen it... But... Well, yeah.

See you in October!
