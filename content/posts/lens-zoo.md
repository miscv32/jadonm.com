---
title: the logit lens zoo
date: 2026-11-28
---

In this post I try to explain a whole host of logit lens variants. If you have a specific lens you'd like to understand, this post's best read in order according to the (interactive) graph of contents. Otherwise, you can read this top-to-bottom; I've arranged the sections such that a lens' prerequisites precede it. You may or may not find the prerequisites helpful, but I'd recommend reading the transformer architecture recap at a minimum before you continue if you're not already familiar with transformers. 

If you just want to know which lens to choose for your interpretability project, the MATS [*Which lens should I use?*](https://github.com/MATSResearch/compute_wiki/blob/master/docs/interpretability/mech-interp.md#which-lens-should-i-use-decision-table) decision table might be a good place to start.

[WorkspaceBench](https://www.lesswrong.com/posts/Zeg2JztbdhguL48uH/workspacebench-evaluating-interpretability-methods-for-the) is a benchmark for global workspace lenses. It's worth reading the LW post (especially the section *Desiderata of a workspace reader*) to understand the kind of tasks that we'd like our lenses to do well on.

<object data="../resource/lens-zoo/lens-family.svg" type="image/svg+xml" aria-label="Logit Lens family tree" style="display: block; width: 100%; aspect-ratio: 808 / 545;">
  <a href="../resource/lens-zoo/lens-family.svg">open the Logit Lens family tree</a>
</object>

## what is a lens?
Loosely, a lens is anything that takes model activations and produces a potentially workspace-like[^workspace], somewhat human-interpretable, maybe causally relevant output. This output is usually a distribution over tokens, or sometimes multi-token trajectories. Tools like labelled SAE features, labelled MLP neurons, and NLAs probably also count as lenses, but they don't have "lens" in the name so I won't discuss them here.


## transformer architecture recap & notation reference {#transformer-architecture-recap}
further reading:
:   [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html#high-level-architecture), Anthropic (2021)

<figure class="lens-diagram architecture-recap-figure">
  <iframe src="../resource/lens-zoo/residual-stream.svg?view=recap" title="Transformer architecture diagram"></iframe>
</figure>

- A transformer takes a sequence of tokens as input.
- Each token is a one-hot vector of shape $|V| \times 1$, i.e. the token that we assign index $i$ is represented by the vector where $v_i = 1$, $v_j |_{j \ne i} = 0$
- First, we apply the "embedding matrix" which "down-projects" the $|V| \times 1$ token to a $d_{model} \times 1$ residual-stream vector

- Transformer blocks (layers), at a high level, read from and write to the residual stream based on the earlier tokens in the sequence and the residual stream as seen at their input.
    - You can think of attention heads as responsible for looking back at earlier tokens, and writing relevant information from those tokens into the residual stream, and the MLPs as responsible for doing various computations and transformations with the information in the residual stream.

- Finally, the residual-stream vector is "up-projected" from $d_{model} \times 1$ to $|V| \times 1$ by the unembedding matrix.

- For simplicity, we'll mostly ignore normalisation and softmax-ing.

### notation

- $|V|$ -- "vocabulary size" of model, number of tokens it can represent.

- $\mathbf{e}_i$ -- column vector with $i$-th component 1 and all other components 0. The token with index $i$ is represented before embedding / after sampling by $\mathbf{e}_i$.

- $d_{model}$ -- "hidden dimension", "model dimension"

- $\mathbf{h}_{\ell}$ -- residual stream content after $\ell$ transformer blocks, an arbitrary intermediate position. 
  - shape $d_{model} \times 1$.

- $\mathbf{h}_L$ -- residual stream content after all $L$ transformer blocks, the final position in the residual stream before the unembedding matrix. 
  - shape $d_{model} \times 1$.

- $\mathbf{W}_U$ -- unembedding matrix. 
  - $\mathbf{W}_U\mathbf{h}_L$ yields the logits.

- $\mathbf{W}_E$ -- embedding matrix. 
  - $\mathbf{W}_E\mathbf{e}_i = \mathbf{h}_0$

- $F_{a:b}$ -- composition of transformer layers $[a, b]$ (i.e. inclusive of layers a and b) as a function.
  - $\mathbf{h}_b = F_{a:b}(\mathbf{h}_{a-1})$


## *the* logit lens {#logit-lens}
prerequisites:
:   [what is a lens?](#what-is-a-lens), [transformer architecture recap](#transformer-architecture-recap).

further reading:
:   [interpreting GPT: the logit lens](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens), `nostalgebraist` (2020)

The logit lens is simple to implement; we apply the unembedding matrix at an intermediate point in the residual stream. An equivalent way of thinking about this is that we "cut out" further transformer blocks past some point in the residual stream. Mathematically, the logit lens on $\mathbf{h}_{\ell}$ replaces $F_{\ell+1:L}$ with the identity function. 

~~~{=html}
<div class="figure-pane-toolbar" data-figure-controls>
  <p class="figure-pane-toggle" data-figure-panes="Logit lens" data-figure-message="residualStreamView" role="group" aria-label="Logit lens diagram view" hidden>
    <button type="button" data-slide="full" aria-pressed="true" aria-controls="residual-stream-figure">Full transformer</button>
    <span aria-hidden="true">·</span>
    <button type="button" data-slide="lens" aria-pressed="false" aria-controls="residual-stream-figure">Logit lens</button>
  </p>
</div>

<figure class="lens-diagram logit-lens-figure">
  <iframe id="residual-stream-figure" src="../resource/lens-zoo/residual-stream.svg" title="Transformer and logit lens diagram"></iframe>
</figure>
~~~

<script src="../js/figure-panes.js" defer></script>

Why does this work at all?

If a layer "wants" to push the next-token prediction towards a specific token $\mathbf{e}_i$, the best way for it to transmit this information is by writing the vector $\mathbf{v}$ to the residual stream, where $\mathbf{e}_i \approx \mathbf{W}_U\mathbf{v}$.

On the other hand, if a layer has information that it intends for a later layer to read as part of a circuit, there's no reason that the way it writes this information to the residual stream should have any relation to the unembedding matrix, since the later layer(s) can easily transform these directions arbitrarily.

So, we might think that the interpretable part of the logit lens output is the model's "best guess" at what the next token is, since information that is supposed to be further processed before affecting the prediction is unlikely to "line up" with directions that strongly push the output distribution towards a specific token.

As you'd expect, the output of the logit lens is not very interpretable when applied on the lower layers, since much of the residual stream content is written to transmit information to later layers for further computation. Despite this, it's still likely that a model represents concepts that correspond well to certain tokens even in earlier layers. We'll call the tendency for average token-concept representations at intermediate layers to drift from the "inverse-unembedding" "basis"[^inverseunembedding], *representational drift*.

Another important limitation of the logit lens is that it doesn't target the model's *global workspace* well.

The global workspace is (handwavingly) the space of concepts which a model has "conscious" access to, i.e. that it can accurately report on and manipulate at will. For instance, when answering a dastardly difficult multi-step reasoning problem like "What colour are the buses in the city containing Buckingham Palace?", we might expect to observe concepts relating to the words "bus", "city", "Buckingham Palace", "London", and "red" in the workspace.

As explained earlier, the logit lens can be thought of as a best-guess, given an intermediate residual stream vector, at the final logits. For the multi-step reasoning problem stated above, it's quite clear that "London" is an unlikely final answer, so a model might avoid pushing the next-token prediction towards "London", even though it's likely the model represents a concept for "London" internally as part of an intermediate reasoning step.

next:
:   [tuned lens](#tuned-lens), [j-lens](#j-lens), [future lens](#future-lens), [chain lens](#chain-lens), or [coda lens](#coda-lens).

## tuned lens {#tuned-lens}
prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Eliciting Latent Predictions from Transformers with the Tuned Lens](https://arxiv.org/html/2303.08112#S3), Belrose *et al.* (2023)

We saw earlier that the logit lens fails to account for *representational drift*, that is, the same token-concepts being represented differently at different points in the residual stream. To account for this, the tuned lens on $\mathbf{h}_{\ell}$ trains an affine[^affine] "translator" to approximate $F_{\ell+1:L}$. 

~~~{=html}
<div class="figure-pane-toolbar" data-figure-controls>
  <p class="figure-pane-toggle" data-figure-panes="Tuned lens" data-figure-message="residualStreamView" role="group" aria-label="Tuned lens diagram view" hidden>
    <button type="button" data-slide="full" aria-pressed="false" aria-controls="tuned-lens-figure">Full transformer</button>
    <span aria-hidden="true">·</span>
    <button type="button" data-slide="lens" aria-pressed="true" aria-controls="tuned-lens-figure">Tuned lens</button>
  </p>
</div>

<figure class="lens-diagram tuned-lens-figure">
  <iframe id="tuned-lens-figure" src="../resource/lens-zoo/residual-stream.svg?lens=tuned" title="Transformer and tuned lens diagram"></iframe>
</figure>
~~~

As long as the representational drift is well approximated by an affine transformation, the tuned lens should correct for this and provide a more interpretable readout, especially at earlier layers where the drift is worse.

As long as the computation done by the transformer layers after some point is *not* well approximated by an affine transformation, the translator that replaces them should be incapable of learning to "shortcut" intermediate activations to last-layer activations. If our translator copies the computation done by the transformer layers it replaces too well, it becomes useless, since we lose access to the intermediate steps we're interested in.

Of course, neither of these assumptions are entirely true. Tuned lenses *do* tend to produce more coherent outputs at earlier layers compared to logit lenses, but in practice they sometimes have the capacity to approximate the remaining transformer layers fairly well, skipping over intermediate token-concept representations that other lenses can recover.

Unfortunately, like its [younger sibling](#logit-lens), the tuned lens still doesn't target the model's workspace well.

The aim of a tuned lens is to [Elicit Latent Predictions](https://arxiv.org/html/2303.08112#S3), and therefore it shouldn't be surprising that tuned lens output distribution at later layers roughly monotonically converges towards the model's actual output distribution. We trained our "translators" to minimise prediction error, and it's intuitive that at later layers the output is easier to predict from the hidden state.

However, we might expect the workspace token distributions to occasionally diverge from the final next-token prediction when the model does multi-step reasoning. This suggests that the tuned lens, too, doesn't reliably target the model's workspace.

next:
:   [future lens](#future-lens).

## j-lens {#j-lens}
prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/#methods-jlens), Anthropic (2026)

The J-lens is a significant improvement on the logit lens, allowing us to observe workspace-like behaviour. 

How does it work? From [*'Verbalizable representations...'*](https://transformer-circuits.pub/2026/workspace/#methods-jlens) (emphasis mine):

> Concretely, it computes, for each layer, the **average linearized effect of an activation on the model's likelihood of producing a particular token** (now or in the future), averaging over a large corpus of contexts...

This means that how a direction in the residual stream tends to *change* the token distribution, averaged over many contexts, tells us its meaning. 

Mathematically, the logit shift that we want to assign to $\mathbf{h}_{\ell}$ is

$$\mathbf{W}_U \frac{\partial F_{\ell+1:L}}{\partial \mathbf{h}_\ell} \mathbf{h}_\ell = \mathbf{W}_U \mathbf{J} \mathbf{h}_\ell$$

$\mathbf{J}$ is called the Jacobian. Calculating the average Jacobian over all contexts exactly is intractable for the models we care about, so instead we estimate it by evaluating the model over many contexts, backpropagating from $\mathbf{h}_L$ at the current token position and subsequent token positions to $\mathbf{h}_{\ell}$, and taking an average.

For intuition though, it's helpful to think about the effect of small perturbations of $\mathbf{h}_\ell$. Over a large number of contexts we could perturb $\mathbf{h}_{\ell}$ by some small amount $\varepsilon \mathbf{e}_c$, then take the mean of differences 

$$\frac{F_{\ell+1:L}(\mathbf{h}_{\ell} + \varepsilon \mathbf{e}_c) - F_{\ell+1:L}(\mathbf{h}_{\ell})}{\varepsilon}$$

as the "average linearised effect of an activation on the model's likelihood of producing a particular token". Repeating this for all basis vectors $\mathbf{e}_i$ through $\mathbf{e}_{d_{model}}$ yields an estimate for $\mathbf{J}$ which we can use to transform arbitrary $\mathbf{h}_{\ell}$.

~~~{=html}
<div class="figure-pane-toolbar" data-figure-controls>
  <p class="figure-pane-toggle" data-figure-panes="J-lens" role="group" aria-label="J-lens diagram steps" hidden>
    <button type="button" data-slide="average" aria-pressed="true" aria-controls="j-lens-figure">Average effects</button>
    <span aria-hidden="true">·</span>
    <button type="button" data-slide="readout" aria-pressed="false" aria-controls="j-lens-figure">Read out</button>
  </p>
  <div class="j-lens-steps" data-slide-steps="average" role="group" aria-label="Average effects slideshow" hidden>
    <button type="button" data-direction="-1" aria-label="Previous step" aria-controls="j-lens-figure" disabled>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 L9 12 L15 6"/></svg>
    </button>
    <span role="status" aria-atomic="true">1 / 5</span>
    <button type="button" data-direction="1" aria-label="Next step" aria-controls="j-lens-figure">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18 L15 12 L9 6"/></svg>
    </button>
  </div>
</div>
<figure class="lens-diagram j-lens-figure">
  <iframe id="j-lens-figure" src="../resource/lens-zoo/j-lens.svg#average-1" title="J-lens diagram: Average effects, Context 1"></iframe>
</figure>
~~~

We'll call the space with "basis" given by the rows of $\mathbf{W}_U \mathbf{J}$ the J-space. Actually, the rows of $\mathbf{W}_U \mathbf{J}$ form an overcomplete set, but if we say that the J-space is the set of sparse, non negative combinations of those rows, then we get something that looks like a high-dimensional space.

Empirically, the J-space acts like a workspace. Intervening on $\mathbf{h}_{\ell}$ by adding/subtracting J-lens vectors to it affects the model's output the way we'd expect it to if the J-space were a global workspace, and the model can "introspect" on the concepts in its J-space, and manipulate them on command. 

Why would we expect the J-lens to access the model's *global workspace*?

- J-space vectors can represent intermediate steps without steering $\mathbf{h}_\ell$ towards the intermediate step's token. We already saw this is a desideratum that [logit](#logit-lens) and [tuned](#tuned-lens) lenses lack.

- The J-space vector for a token-concept still ends up steering the final prediction to that token in the average context, so it probably represents a concept related to that token to the model itself.

next:
:   [template lens](#template-lens), [r-lens](#r-lens), [chain lens](#chain-lens), [j++ lens](#j-plus-plus-lens), or [k-lens](#k-lens).

## future lens {#future-lens}
prerequisites:
:   [*the* logit lens](#logit-lens), [tuned lens](#tuned-lens).

further reading:
:   [Future Lens: Anticipating Subsequent Tokens from a Single Hidden State](https://aclanthology.org/2023.conll-1.37.pdf), Pal *et al.* (2023)

The future lens is quite different from the lenses we've seen up to this point. We take advantage of the model's latent capability to understand its own activations to produce multiple tokens from a hidden state.

Suppose we measure $\mathbf{h}_{\ell}(\mathcal{C}_1)$ from a model prompted with context $\mathcal{C}_1$ that produces output $\mathbf{y}_1 = \mathbf{y}(\mathcal{C}_1)$ and "patch" $\mathbf{h}_{\ell}(\mathcal{C}_1)$ into the model at the same layer under another context $\mathcal{C}_2$, forcing $\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_1)$. 

You might naively hope that the output after this intervention, $\mathbf{y}(\mathcal{C}_2;\,\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_1))$, will be much closer to $\mathbf{y}_1$ than the output without this intervention $\mathbf{y}_2 = \mathbf{y}(\mathcal{C}_2)$ is. This is plausible, since remaining layers, $F_{\ell+1:L}$, are able to understand the contents of $\mathbf{h}_{\ell}(\mathcal{C}_1)$ and output differently based on this. However, $F_{\ell+1:L}$ is also dependent on $\mathcal{C}_2 \ne \mathcal{C}_1$. The conflicting context prevents the patched activation from steering well.

The future lens optimises the same "soft prompt" $\mathcal{P}_\theta$ over many interventions $\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_i)$ so that $\mathbf{y}(\mathcal{P}_\theta;\,\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_i)) \rightarrow \mathbf{y}(\mathcal{C}_i)$

~~~{=html}
<div class="figure-pane-toolbar" data-figure-controls>
  <p class="figure-pane-toggle" data-figure-panes="Future Lens" role="group" aria-label="Future Lens diagram view" hidden>
    <button type="button" data-slide="predict" aria-pressed="true" aria-controls="future-lens-figure">Predict and patch</button>
    <span aria-hidden="true">·</span>
    <button type="button" data-slide="train" aria-pressed="false" aria-controls="future-lens-figure">Train the prompt</button>
  </p>
</div>
<figure class="lens-diagram future-lens-figure">
  <iframe id="future-lens-figure" src="../resource/lens-zoo/future-lens.svg#predict" title="Future Lens diagram: Predict and patch"></iframe>
</figure>
~~~

The idea here is that $\mathcal{P}_\theta$ will be optimised to only contain information which helps generalised prediction capability like "output grammatically correct text" or "output more common words instead of rarer ones" and therefore the output on the soft prompt + unseen activation is only a function of the unseen activation. 

The future lens also nicely generalises to multi-token readouts. On decoding further tokens we give the soft prompt concatenated with the earlier decoded tokens and perform the same hidden state intervention:

$$ 
\hat t_k =
\operatorname{Next}\!\left(
  \mathcal P_\theta \mathbin{\Vert} \hat t_{<k};
  \,\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal C_i)
\right),
\qquad k\ge 1.
$$

::: {.dropdown summary="training $\mathcal{P}_\theta$ for multiple token continuation"}

$\mathcal P_\theta \mathbin{\Vert} \hat t_{<k}$ doesn't necessarily have the same nice properties as $\mathcal P_\theta$ that allow it to elicit accurate predictions based on the injected hidden state. In the *Future Lens* paper they train $\mathcal P_\theta$ with one continuation token $\hat t_{1}$ already appended, as produced by the model with original context $\mathcal{C}_i$, and find that it works best. 🤷
:::

As far as I am aware, the future lens was the first lens to produce a multi-token readout. We'll see some other examples later.

The future lens is in principle not a workspace lens. $F_{\ell+1:L}$ might contain circuits that the injected residual-stream vector happens to contain the global workspace inputs for. The output then "skips over" these intermediate inputs we'd like our lens to access and instead computes the next-token prediction.

## template lens {#template-lens}
prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/#app-template-lens), Anthropic (2026)

The output of the J-lens is restricted to single tokens. This is quite a severe limitation, because many of the concepts we care about can't be represented in a human-interpretable way by a single token. The template lens is a J-lens-esque technique for these multi-token concepts.

We start with a list of D multi-token words/phrases $w_1, ..., w_D$. For each $w_i$, we prompt our model to write a large number of diverse passages where $w_i$ is the natural completion, but $w_i$ doesn't appear anywhere in the passage. We run the model over our passages for $w_i$ and collect $\mathbf{h}_\ell$ at the last token of the passage, taking the mean as $\boldsymbol{\mu}_i(\ell)$. We'll call the mean $\mathbf{h}_\ell$ over all passages and words $\boldsymbol{\mu}(\ell)$. 

The template lens is then defined as follows:

  $$\text{TemplateLens}_\ell(\mathbf{x}) = \mathbf{T}_\ell^\top \mathbf{x}$$


  $$\mathbf{T}_\ell = \left[\mathbf{t}_1(\ell)\ \cdots\ \mathbf{t}_D(\ell)\right]$$

  $$\mathbf{t}_i(\ell) = (\boldsymbol{\Sigma}_\ell + \lambda \mathbf{I})^{-1}(\boldsymbol{\mu}_i(\ell) - \boldsymbol{\mu}(\ell))$$

Essentially, we compare how similar $\mathbf{x}$ is to the difference-in-mean-activations for a given concept $\Delta\boldsymbol{\mu}(\ell) = \boldsymbol{\mu}_i(\ell) - \boldsymbol{\mu}(\ell)$. We *whiten*[^whiten] $\mathbf{x}$ and $\Delta\boldsymbol{\mu}(\ell)$ to account for the fact that some directions have lower variance than others, so in those directions a larger $\mathbf{x}$ or $\Delta\boldsymbol{\mu}(\ell)$ is more significant.

next:
:   [oracle lens](#oracle-lens).

## r lens {#r-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [R-lens: Making J-lens More Faithful on Early Layers](https://www.lesswrong.com/posts/nv8oedrnLXKRzNEL9/r-lens-making-j-lens-more-faithful-on-early-layers#Methods__the_R_Lens), `camilablank` *et al.* (2026)

The R-lens is a modification to the J-lens which uses *Layerwise Relevance Propagation* instead of backpropagation. I'll focus on intuition & differences in modelling assumptions between the J-lens and R-lens, because the implementation is not very illuminating in my opinion. Importantly, the R-lens has improved empirical performance in early layers compared to the J-lens. It's since been outperformed by the J++, which also uses relevance propagation.  

I have two basic intuitions for why LRP might be better to use than good-old-fashioned backprop.

### 1. denoising gradients
LRP can be thought of as a modification of backpropagation. It might stop / downweight gradient terms where we'd have a systematically wrong approximation of finite differences in $\mathbf{h}_L$ given $\frac{\partial \mathbf{h}_L}{\partial \mathbf{h}_{\ell}}$ alone. This reduces their effect on the estimate of $\mathbf{J}$. Therefore our estimate of $\mathbf{J}$ using LRP should work better to approximate finite differences.

### 2. sensitivity vs contribution
 
Contribution is defined fairly intuitively: if $y = 6a - 7b + cd$, $a$ contributes $6a$, and $b$ contributes $-7b$. $c$ and $d$ both contribute $\frac{cd}{2}$. 

On the other hand, the sensitivity of $y$ to $a$ tells us how a change in $a$ affects $y$. $y$'s sensitivity to $a$ is entirely described by $\frac{\partial y}{\partial a} = 6$, etc. In general, the sensitivity of an output to an input is described by the (potentially infinite) sequence of $n$-th derivatives, and might be dependent on other inputs (consider $\frac{\partial y}{\partial c}$). 

It turns out that if we replace backprop with LRP in our J-lens estimation process, instead of a matrix ($\mathbf{J}$) telling us the average first order sensitivity of $\mathbf{h}_L$ to $\mathbf{h}_{\ell}$, we get a matrix ($\mathbf{R}$) telling us the average *contribution* of $\mathbf{h}_{\ell}$ to $\mathbf{h}_L$. 

In principle, $\mathbf{R}$ can model the average contributions entirely, whereas $\mathbf{J}$ can only ever model the average first-order sensitivity. It could be that for our purposes, a complete model of average contributions is better than an incomplete model of average sensitivity, even though our intuition from the J-lens was that the concept of sensitivity better captures what we want a good lens to read:

>  ...how a direction in the residual stream tends to change the token distribution, averaged over many contexts, tells us its meaning.



next:
:   [j++ lens](#j-plus-plus-lens) or [s-lens](#s-lens).

## chain lens {#chain-lens}

prerequisites:
:   [*the* logit lens](#logit-lens), [j-lens](#j-lens).

further reading:
:   [The Chain Lens \[interim\]](https://www.lesswrong.com/posts/Nr6fksEqqxNpdz6rk/the-chain-lens-interim#Method), Vogel and Douglas (2026)

The chain lens is a straightforward improvement on the J-lens which uses multi-token prediction heads[^mtp] with contrastive decoding[^contrastivedecoding] to elicit multi-token predictions from the J-lens.

$$ \operatorname{ChainLens}_\ell(\mathbf{h}_{\ell}) = \operatorname{MultiTokenPrediction}(\mathbf{J}\mathbf{h}_{\ell})$$



## j++ lens {#j-plus-plus-lens}

prerequisites:
:   [j-lens](#j-lens), [r lens](#r-lens).

further reading:
:   [J++ Lens: Jacobian Filtering Enables More Faithful Workspace Lenses](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses), Ayonrinde and Lindsey (2026)

The J++ lens is another J-lens variant, incorporating LRP as introduced by the R-lens. Importantly, the J++ lens does *Jacobian Filtering*. Also, the J++-lens restricts its readouts to tokens with semantic meaning ("readout filtering" in the jargon of the paper).

The core idea for Jacobian filtering is quite simple. We first partition the activation space into $E$ subsets $C_1$ through $C_E$. We then fit Jacobians $\mathbf{J}_i$ for each $C_i$, by using the same procedure as the R-lens but restricted to average $\frac{\partial \mathbf{h}_L}{\partial \mathbf{h}_{\ell}}$ for  $\mathbf{h}_{\ell} \in C_i$. These Jacobians are referred to as "expert" Jacobians, by analogy to the mixture of experts architecture in transformers[^moe]. We create a benchmark of latent-variable extraction problems (like the example in the penultimate paragraph of the [logit lens](#logit-lens) section) to test how well the lens accesses the model's workspace, and then optimise weights $w_i$ for each $\mathbf{J}_i$ so that $\sum_i w_i \mathbf{J}_i$ has good performance on this benchmark.

The authors show empirically that Jacobian filtering is responsible for most of the J++ lens' uplift over the J and R lenses[^jpp-filtering-ablation].

This makes sense, because we chose weights that perform well on our benchmark. If we assume that some noisy components are responsible for making the J-lens perform poorly, then downweighting or zeroing the noisy components should make the lens perform better. The authors find some evidence for this; removing the worst-performing experts from the R-lens improves performance[^jpp-drop-worst], and the single best expert recovers most of the uplift of the J++-lens[^jpp-best-expert]. However, it's not so clear to me what mechanism explains the rest of the uplift.

You could argue there is potential for overfitting $\{w_i\}_{i=1}^{E}$. Empirically, this doesn't seem to be the case[^jpp-leave-one-out]. In this case, if the activation space partition $\{C_i\}_{i=1}^{E}$ is sufficiently coarse, it is unlikely that the weights have enough capacity to overfit to the training benchmark. 

The authors also explore some hypotheses as to why some expert Jacobians are worse than others. They find some evidence that the poorly performing experts were more often fit on non-semantic tokens[^jpp-non-semantic-experts], although this doesn't exclusively explain the bad experts.



## oracle lens {#oracle-lens}

prerequisites:
:   [template lens](#template-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/#app-oracle-lens), Anthropic (2026)


The oracle lens is another lens from Anthropic's *Global Workspace* paper, but it's quite a bit more elaborate than the J-lens and template lens, using a pipeline of self-supervised models to recover arbitrary multi-token phrases from a residual-stream vector. 

First, we train a *reconstructor*. This is a copy of our base model fine-tuned to map a short[^phraselength] phrase of text to $\mathbf{r}_{\ell}$, an activation vector which is ideally equal to $\mathbf{h}_{\ell}$. We sample $\mathbf{h}_\ell$ at the token position immediately before the phrase.

<figure class="lens-diagram" style="--diagram-fit-width: 620; --diagram-fit-height: 312;">
  <iframe src="../resource/lens-zoo/oracle-training.svg" title="Oracle teacher and reconstructor training"></iframe>
</figure>

Like in the template lens, our $\mathbf{r}_{\ell}$s and $\mathbf{h}_{\ell}$s are whitened so that errors in directions which typically vary less are up-weighted and vice-versa. I won't keep mentioning whitening explicitly since it's not that consequential to understanding how the lens works, but it's used consistently throughout the process.

Next, we build a list of multi-token phrases sampled from model-generated text (you can read the Anthropic paper for more detail on how exactly this is done). We'll then pass our phrases through the reconstructor model to produce a dictionary mapping phrases to phrase vectors.

The dictionary of phrase vectors is used to label unseen activations from the model while it is generating text in the `<|assistant|>` turn. We ‘decompose’ these activations into an ordered list of (at most) $K$ phrase vectors from our dictionary which hopefully explain the variance of $\mathbf{h}_\ell$.


::: {.dropdown summary="how does the decomposition work?"}
The algorithm for decomposing an activation vector into phrase vectors looks like this:

$$
\begin{aligned}
&\text{Input: activation } \mathbf{h}_\ell \\
&\phantom{\text{Input: }}\text{dictionary } D \text{ of phrases with length } N \\
&\phantom{\text{Input: }}\text{maximum number of phrases } K \\
&\text{Sample } S \subseteq D \text{ uniformly subject to } |S|=\tfrac12|D| \\
&\boldsymbol{\delta} \gets \mathbf{h}_\ell,\qquad w_{1:K} \gets \mathbf{0} \\
&\textbf{for } i=1,\ldots,K \textbf{ do} \\
&\qquad \textbf{if } S=\varnothing \text{ or } \boldsymbol{\delta}=\mathbf{0} \textbf{ then break} \\
&\qquad \mathbf{v}_i \gets \operatorname*{arg\,max}_{\mathbf{v}\in S}
    \frac{\mathbf{v}^\top\boldsymbol{\delta}}{\lVert \mathbf{v}\rVert_2\lVert\boldsymbol{\delta}\rVert_2} \\
&\qquad \textbf{if } \mathbf{v}_i^\top\boldsymbol{\delta}\le 0 \textbf{ then break} \\
&\qquad S \gets S\setminus\{\mathbf{v}_i\} \\
&\qquad w_{1:i} \gets \operatorname*{arg\,min}_{u\in\mathbb{R}_{\ge 0}^{i}}
    \left\lVert \mathbf{h}_\ell-\sum_{j=1}^{i}u_j\mathbf{v}_j\right\rVert_2^2 \\
&\qquad \boldsymbol{\delta} \gets \mathbf{h}_\ell-\sum_{j=1}^{i}w_j\mathbf{v}_j \\
&\textbf{end for} \\
&\textbf{return } \text{the pairs } (w_i, \mathbf{v}_i) \text{ in increasing order of } i
\end{aligned}
$$

<https://en.wikipedia.org/wiki/Matching_pursuit>

:::


Finally, we train an *oracle*: yet another fine-tuned copy of our base model, which will reproduce our phrase-vector lists given an injected $\mathbf{h}_\ell$, and a prompt including $N$, the desired phrase length, and $K$, the desired number of phrases in the phrase-vector list. The oracle's training target is the first $K$ phrase-vectors corresponding to phrases of length $N$ generated by our "teacher", the decomposition algorithm. The rank-ordering produced by the oracle ideally matches the teacher's order.

<figure class="lens-diagram" style="--diagram-fit-width: 628; --diagram-fit-height: 400;">
  <iframe src="../resource/lens-zoo/oracle-injection.svg" title="Oracle self-supervised training"></iframe>
</figure>

This might seem pointless, since at best the oracle will match the performance of the decomposition algorithm. However, after this self-supervised fine-tuning step, we further RL-train our oracle model on new assistant-turn activations to maximise the fraction of activation variance its reconstructions explain. There are also slight penalties for high phrase count and deviating from the target phrase count and phrase length given in the prompt.


<figure class="lens-diagram" style="--diagram-fit-width: 544; --diagram-fit-height: 558;">
  <iframe src="../resource/lens-zoo/oracle-inference.svg" title="Oracle lens inference"></iframe>
</figure>

At inference-time we:

1. Sample $\mathbf{h}_{\ell}$ of interest from the base model.

2. Inject $\mathbf{h}_{\ell}$ into our oracle and sample $K$ phrases from the oracle's phrase list.

3. Map each oracle-generated phrase $\mathbf{p}_i$ to an activation direction $\mathbf{r}_i$ using the reconstructor.

4. Choose non-negative coefficients $w_i$ so that $\sum_i w_i\mathbf{r}_i$ is as close as possible to $\mathbf{h}_\ell$.

## coda lens {#coda-lens}

prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Interpreting Inkling 2 Mini](https://www.goodfire.com/research/interpreting-inkling-2-mini#decoding-loops-logit-lens-tuned-lens-coda-lens), Lee *et al.* (2026)

This is a simple lens, conceptually similar to the logit lens, for looped models with architecture similar to Inkling 2 Mini. 

Inkling 2 Mini's architecture consists of a 6-transformer-layer "prelude", followed by a 12-layer "core" and then a 6-layer "coda". The core is looped 3 times, which means after the first forward pass through the core we take the output and pass it through the core 2 times subsequently.

<figure class="lens-diagram coda-lens-figure">
  <iframe src="../resource/lens-zoo/coda-lens.svg" title="Inkling 2 Mini prelude, core passes, and coda"></iframe>
</figure>

The coda lens simply cuts out some number of passes through the core (much in the same manner as the last few transformer blocks are cut out for the logit lens), and applies the coda to read out the inter-pass state. Note that the coda can attend to prior tokens and is therefore not exclusively a function of the inter-pass hidden state at the current token position.

This method is useful as a starting point to interpret what computation is being done in subsequent passes, but is quite limited as a workspace lens. Each pass of the core can do significant computation, which would obscure the intermediate states we wish to recover. Inkling 2 Mini's coda has 6 transformer blocks and is therefore capable of significant computation, which is not desirable for a workspace lens. 



## k-lens {#k-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [K-lens](https://x.com/voooooogel/status/2084858861551526002), Vogel (2026), with [attribution and method in the neuron-lens documentation](https://github.com/stdlogits/neuron-lens#lenses-from-the-logit-lens-to-the-r-lens-and-s-lens)

The K-lens is a natural extension of the J-lens. Instead of finding the Jacobian $\frac{\partial \mathbf{h}_L}{\partial \mathbf{h}_{\ell}}$, we find the transpose of the Jacobian, $(\frac{\partial \mathbf{h}_\ell}{\partial \mathbf{h}_{0}})^\top$:


$$\mathbf{W}_E^{\top}\left(\frac{\partial F_{1:\ell}(\mathbf{h}_0)}{\partial \mathbf{h}_0}\right)^{\top}\mathbf{h}_\ell = \mathbf{W}_E^{\top}\mathbf{K}^{\top}\mathbf{h}_\ell$$

::: {.dropdown summary="what does the Jacobian transpose mean? What does $\mathbf{W}^{\top}_{E}$ mean?"}
$$
\mathbf{K} =
\left[\begin{array}{ccccc}
\uparrow & & \uparrow & & \uparrow \\
\frac{\partial \mathbf{h}_\ell}{\partial h_{0,1}} & \cdots &
\frac{\partial \mathbf{h}_\ell}{\partial h_{0,j}} & \cdots &
\frac{\partial \mathbf{h}_\ell}{\partial h_{0,d_{model}}} \\
\downarrow & & \downarrow & & \downarrow
\end{array}\right]
$$

The $j$-th element of $\mathbf{K}^\top\mathbf{h}_\ell$ tells us the dot product between the $j$-th column of $\mathbf{K}$ and $\mathbf{h}_\ell$.  So $(\mathbf{K}^\top\mathbf{h}_\ell)_j$ is basically telling us how similar $\mathbf{h}_\ell$ is to $\frac{\partial \mathbf{h}_\ell}{\partial h_{0,j}}$

In a similar vein $(\mathbf{W}_E^\top\mathbf{h}_\ell)_j$ tells us how similar $\mathbf{h}_\ell$ is to the embedding of the $j$-th token, $(\mathbf{W}_E)_{:,j}$
:::


We estimate $\mathbf{K}$ in the same manner as $\mathbf{J}$. We can interpret the output of $\operatorname{KLens}(\mathbf{h}_\ell)$ as telling us which input tokens would push the state at layer $\ell$  in the direction of $\mathbf{h}_\ell$ on average.

<figure class="lens-diagram lens-comparison-figure">
  <iframe src="../resource/lens-zoo/lens-comparison.svg" title="Comparison of the K-lens and J-lens"></iframe>
</figure>

next:
:   [s-lens](#s-lens).

## s-lens {#s-lens}

prerequisites:
:   [r lens](#r-lens), [k-lens](#k-lens).

further reading:
:   [neuron-lens](https://github.com/stdlogits/neuron-lens#lenses-from-the-logit-lens-to-the-r-lens-and-s-lens), `_a9lim` and `treetowntree` (2026)

S-lens is to [R-lens](#r-lens) as [K-lens](#k-lens) is to [J-lens](#j-lens) :3

<figure class="lens-diagram lens-comparison-figure">
  <iframe src="../resource/lens-zoo/lens-comparison.svg#full" title="Comparison of the logit, J-, K-, R- and S-lenses"></iframe>
</figure>

[^jpp-filtering-ablation]: [Appendix H: Ablations](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#Appendix_H__Ablations), Figure 18 and Table 4, “without Jacobian Filtering (Pooled Jacobian)”.

[^jpp-drop-worst]: [Appendix H: Ablations](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#Appendix_H__Ablations), Table 4, “Pooled Jacobian, two worst experts dropped”.

[^jpp-best-expert]: [Appendix H: Ablations](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#Appendix_H__Ablations), Table 4, “best expert per layer”.

[^jpp-leave-one-out]: [Appendix H: Ablations](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#Appendix_H__Ablations), Table 4, “leave one out, dev set has no overlap with evaluation task”.

[^jpp-non-semantic-experts]: [Appendix G: What Is in the Bad Experts?](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#What_Is_in_the_Bad_Experts_), Figure 13.

[^workspace]: Psychology term referring to the space of consciously accessible and manipulable concepts -- see [Baars (2002)](https://pubmed.ncbi.nlm.nih.gov/11849615/)

[^affine]: An *affine* transformation of a vector $\mathbf{v}$ to $\mathbf{u}$ is described by a matrix $\mathbf{W}$ and vector $\mathbf{b}$, and computed as $\mathbf{u} = \mathbf{W}\mathbf{v} + \mathbf{b}$

[^inverseunembedding]: $\mathbf{e}_i \approx \mathbf{W}_U\mathbf{v}$. Suppose there exists some "inverse-unembedding" matrix $\mathbf{W}^{-1}_U: \text{ } \mathbf{W}^{-1}_U \mathbf{W}_U \approx \mathbb{I}$ and $\mathbf{W}_U \mathbf{W}^{-1}_U \approx \mathbb{I}$. Then $\mathbf{W}^{-1}_U \mathbf{e}_i  \approx \mathbf{v}$, i.e. the columns of the "inverse-unembedding" matrix are the residual vectors that approximately correspond to each token after unembedding. I've put "inverse-unembedding" and "basis" in scare quotes because I am being sloppy and hiding some complexity behind the $\approx$ sign. 

[^mtp]: as the name implies, an MTP head allows multiple tokens to be decoded from a single last-layer residual $\mathbf{h}_L$. Introduced by [Gloeckle *et al.*](https://arxiv.org/html/2404.19737#S2) (2024)

[^contrastivedecoding]: An interesting technique, but slightly out of scope for this post. Introduced by [Li *et al.*](https://arxiv.org/abs/2210.15097) (2022)

[^whiten]: [en.wikipedia.org/wiki/Whitening_transformation](https://en.wikipedia.org/wiki/Whitening_transformation). $\boldsymbol{\Sigma}_\ell$ is the covariance matrix of $\mathbf{h}_\ell$s over all words & all passages. We add $\lambda \mathbf{I}$ as a [ridge regularisation](https://en.wikipedia.org/wiki/Ridge_regression) term which prevents directions with very small variance from dominating $\mathbf{t}_i(\ell)$.

[^phraselength]: phrase length $N$ is variable, the Anthropic paper says they sample $N$ uniformly from $[1,32]$.

[^moe]: [https://en.wikipedia.org/wiki/Mixture_of_experts](https://en.wikipedia.org/wiki/Mixture_of_experts)