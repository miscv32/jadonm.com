---
title: the logit lens zoo
date: 2026-11-21
---

In this post I try to explain a whole host of logit lens variants. If you have a specific lens you'd like to understand, this post's best read in order according to the (interactive) graph of contents. (TODO Lesswrong crosspost edit because no image) Otherwise, you can read this top-to-bottom; I've arranged the sections such that a lens' prerequisites precede it. You may or may not find the prerequisites helpful, but I'd recommend reading the transformer architecture recap at a minimum before you continue if you're not already familiar with transformers. 

If you just want to know which lens to choose for your interpretability project, the MATS [*Which lens should I use?*](https://github.com/MATSResearch/compute_wiki/blob/master/docs/interpretability/mech-interp.md#which-lens-should-i-use-decision-table) decision table might be a good place to start.

<object data="../resource/lens-zoo/lens-family.svg" type="image/svg+xml" aria-label="Logit Lens family tree" style="display: block; width: 100%; aspect-ratio: 1200 / 617;">
  <a href="../resource/lens-zoo/lens-family.svg">open the Logit Lens family tree</a>
</object>

## what is a lens?
Loosely, a lens is anything that takes model activations and produces a potentially workspace-like[^workspace], somewhat human-interpretable, maybe causally relevant output. This output is usually a distribution over tokens, or sometimes multi-token trajectories. Tools like labelled SAE features, labelled MLP neurons, and NLAs probably also count as lenses, but they don't have "lens" in the name so I won't discuss them here.


## transformer architecture recap & notation reference {#transformer-architecture-recap}
further reading:
:   [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html), Anthropic (2021)

<figure class="lens-diagram architecture-recap-figure">
  <iframe src="../resource/lens-zoo/residual-stream.svg?view=recap" title="Transformer architecture diagram"></iframe>
</figure>

- A transformer takes a sequence of tokens as input.
- Each token is a one-hot vector of shape $|V| \times 1$, i.e. the token that we assign index $i$ is represented by the vector where $v_i = 1$, $v_j |_{j \ne i} = 0$
- First, we apply the "embedding matrix" which "down-projects" the $|V| \times 1$ token to a $d_{model} \times 1$ residual-stream vector

- Transformer blocks (layers), at a high level, read from and write to the residual stream based on the earlier tokens in the sequence and the residual stream as seen at their input.
    - You can think of attention heads as responsible for looking back at earlier tokens, and writing relevant information from those tokens into the residual stream, and the MLPs as responsible for doing various computations and transformations with the information in the residual stream.

- Finally, the residual-stream vector is "up-projected" from $d_{model} \times 1$ to $|V| \times 1$ by the unembedding matrix. The resulting vector can be interpreted as a log-probability distribution over tokens, given the model parameters and sequence of already-seen tokens.

- For simplicity, we'll ignore normalisation and softmax-ing.

### notation
TODO make notation consistent throughout text and in diagrams

- $|V|$ -- "vocabulary size" of model, number of tokens it can represent.

- $\mathbf{e}_i$ -- column vector with $i$-th component 1 and all other components 0. The token with index $i$ is represented before embedding / after sampling by $\mathbf{e}_i$.

- $d_{model}$ -- "hidden dimension", "model dimension"

- $\mathbf{h}_{\ell}$ -- residual stream content after $l$ transformer blocks, an arbitrary intermediate position. 
  - shape $d_{model} \times 1$.

- $\mathbf{h}_L$ -- residual stream content after all $L$ transformer blocks, the final position in the residual stream before the unembedding matrix. 
  - shape $d_{model} \times 1$.

- $\mathbf{W}_U$ -- unembedding matrix. 
  - $\mathbf{W}_U\mathbf{h}_L$ yields the predicted next-token distribution.

- $\mathbf{W}_E$ -- embedding matrix. 
  - $\mathbf{W}_E\mathbf{e}_i = \mathbf{h}_0$

- $F_{a:b}$ -- composition of transformer layers $[a, b]$ (i.e. inclusive of layers a and b) as a function.
  - $\mathbf{h}_b = F_{a:b}(\mathbf{h}_{a-1})$


## *the* logit lens {#logit-lens}
prerequisites:
:   [what is a lens?](#what-is-a-lens), [transformer architecture recap](#transformer-architecture-recap).

further reading:
:   [interpreting GPT: the logit lens](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens), `nostalgebraist` (2020)

The logit lens is simple to implement; we apply the unembedding matrix at an intermediate point in the residual stream. An equivalent way of thinking about this is that we "cut out" further transformer blocks past some point in the residual stream. Mathematically, the logit lens on $\mathbf{h}_{\ell}$ replaces $F_{l+1:L}$ with the identity function. 

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

If a layer "wants" to push the next-token prediction towards a specific token $\mathbf{e}_i$, the best way for it to transmit this information is by writing the vector $\mathbf{v}$ to the residual stream, where $\mathbf{e}_i$ =  $\mathbf{W}_U\mathbf{v}$.

On the other hand, if a layer has information that it intends for a later layer to read as part of a circuit, there's no reason that the way it writes this information to the residual stream should have any relation to the unembedding matrix, since the later layer(s) can easily transform these directions arbitrarily.

So, we might think that the interpretable part of the logit lens output is the model's "best guess" at what the next token is, since information that is supposed to be further processed before affecting the prediction is unlikely to "line up" with directions that strongly push the output distribution towards a specific token.

As you'd expect, the output of the logit lens is not very interpretable when applied on the lower layers, since much of the residual stream content is written to transmit information to later layers for further computation. Despite this, it's still likely that a model represents concepts that correspond well to certain tokens even in earlier layers. We'll call the tendency for average token-concept representations at intermediate layers to drift from the inverse-unembedding "basis"[^inverseunembedding], *representational drift*.

Another important limitation of the logit lens is that it doesn't target the model's *global workspace* well.

The global workspace is (handwavingly) the space of concepts which a model has "conscious" access to, i.e. that it can accurately report on and manipulate at will. For instance, when answering a dastardly difficult multi-step reasoning problem like "What colour are the buses in the city containing Buckingham Palace?", we might expect to observe concepts relating to the words "bus", "city", "Buckingham Palace", "London", and "red" in the workspace.

As explained earlier, the logit lens can be thought of as a best-guess at the next token. For the multi-step reasoning problem stated above, it's quite clear that "London" is an unlikely final answer, so a model might avoid pushing the next-token prediction towards "London", even though it's likely the model represents a concept for "London" internally as part of an intermediate reasoning step.

next:
:   [tuned lens](#tuned-lens), [j-lens](#j-lens), [future lens](#future-lens), [chain lens](#chain-lens), or [coda lens](#coda-lens).

## tuned lens {#tuned-lens}
prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Eliciting Latent Predictions from Transformers with the Tuned Lens](https://arxiv.org/pdf/2303.08112), Belrose *et al.* (2023)

We saw earlier that the logit lens fails to account for *representational drift*, that is, the same token-concepts being represented differently at different points in the residual stream. To account for this, the tuned lens on $\mathbf{h}_{\ell}$ trains an affine[^affine] "translator" to approximate $F_{l+1:L}$. 

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

The aim of a tuned lens is to [Elicit Latent Predictions](https://arxiv.org/pdf/2303.08112), and therefore it shouldn't be surprising that tuned lens output distribution at later layers roughly monotonically converges towards the model's actual output distribution. We trained our "translators" to minimise prediction error, and with each successive layer we give them input with greater *mutual information* with the output they're trying to predict.

However, we might expect the workspace token distributions to occasionally diverge from the final next-token prediction when the model does multi-step reasoning. This suggests that the tuned lens, too, doesn't reliably target the model's workspace.

next:
:   [future lens](#future-lens) or [omnilens](#omnilens).

## j-lens {#j-lens}
prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/), Anthropic (2026)

The J-lens is a significant improvement on the logit lens, allowing us to observe workspace-like behaviour. 

How does it work? From [*'Verbalizable representations...'*]((https://transformer-circuits.pub/2026/workspace/)) (emphasis mine):

> Concretely, it computes, for each layer, the **average linearized effect of an activation on the model's likelihood of producing a particular token** (now or in the future), averaging over a large corpus of contexts...

This means that how a direction in the residual stream tends to *change* the token distribution, averaged over many contexts, tells us its meaning. 

Mathematically, the token-concept distribution that we want to assign to $\mathbf{h}_{\ell}$ is

$$\mathbf{W}_U \frac{\partial F_{l+1:L}}{\partial \mathbf{h}_L} = \mathbf{W}_U \mathbf{J}$$

$\mathbf{J}$ is called the Jacobian. Calculating the Jacobian exactly is intractable for the models we care about, so instead we estimate it by evaluating the model over many contexts. In each context we perturb $\mathbf{h}_{\ell}$ by some small amount $\varepsilon \mathbf{e}_c$, then take the mean of differences 

$$\frac{F_{l+1:L}(\mathbf{h}_{\ell} + \varepsilon \mathbf{e}_c) - F_{l+1:L}(\mathbf{h}_{\ell})}{\varepsilon}$$

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

We'll call the space with basis given by the columns of $\mathbf{J}^{-1} \mathbf{W}^{-1}_U$[^jspace] the J-space. 

Empirically, the J-space acts like a workspace. Intervening on $\mathbf{h}_{\ell}$ by adding/subtracting J-space basis vectors to it affects the model's output the way we'd expect it to if the J-space were a global workspace, and the model can "introspect" on the concepts in its J-space, and manipulate them on command. 

Why would we expect the J-lens to access the model's *global workspace*?

- J-space vectors can represent intermediate steps without steering the best-guess $h_l$ towards the intermediate step's token. We already saw this is a desideratum that [logit](#logit-lens) and [tuned](#tuned-lens) lenses lack.

- The J-space vector for a token-concept still ends up steering the final prediction to that token in the average context, so it probably represents a concept related to that token to the model itself.

next:
:   [template lens](#template-lens), [r-lens](#r-lens), [chain lens](#chain-lens), [j++ lens](#j-plus-plus-lens), [k-lens](#k-lens), [$\omega$-J lenses](#omega-j-lenses), or [a-lens](#a-lens).

## future lens {#future-lens}
prerequisites:
:   [*the* logit lens](#logit-lens), [tuned lens](#tuned-lens).

further reading:
:   [Future Lens: Anticipating Subsequent Tokens from a Single Hidden State](https://aclanthology.org/2023.conll-1.37.pdf), Pal *et al.* (2023)

The future lens is quite different from the lenses we've seen up to this point. We take advantage of the model's latent capability to understand its own activations to produce multiple tokens from a hidden state.

Suppose we measure $\mathbf{h}_{\ell}(\mathcal{C}_1)$ from a model prompted with context $\mathcal{C}_1$ that produces output $\mathbf{y}_1 = \mathbf{y}(\mathcal{C}_1)$ and "patch" $\mathbf{h}_{\ell}(\mathcal{C}_1)$ into the model at the same layer under another context $\mathcal{C}_2$, forcing $\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_1)$. 

You might naively hope that the output after this intervention, $\mathbf{y}(\mathcal{C}_2;\,\mathbf{h}_{\ell} \leftarrow \mathbf{h}_{\ell}(\mathcal{C}_1))$, will be much closer to $\mathbf{y}_1$ than the output without this intervention $\mathbf{y}_2 = \mathbf{y}(\mathcal{C}_2)$ is. This is plausible, since remaining layers, $F_{l+1:L}$ are able to understand the contents of $\mathbf{h}_{\ell}(\mathcal{C}_1)$ and output differently based on this. However, $F_{l+1:L}$ is also dependent on $\mathcal{C}_2 \ne \mathcal{C}_1$. The conflicting context prevents the patched activation from steering well.

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

The idea here is that $\mathcal{P}_\theta$ will be optimised to only contain information which helps generalised prediction capability like "output gramatically correct text" and therefore the output on the soft prompt + unseen activation is only a function of the unseen activation. 

The future lens also nicely generalises to multi-token readouts. On decoding further tokens we give the the soft prompt concatenated with the earlier decoded tokens and perform the same hidden state intervention:

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

The future lens is in principle not a workspace lens. $F_{l+1:L}$ might contain circuits that the injected residual-stream vector happens to contain the global workspace inputs for. The output then "skips over" these intermediate inputs we'd like our lens to access and instead computes the next-token prediction.

## template lens {#template-lens}
prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/), Anthropic (2026)
TODO further reading should link to the appendix in which template lens is defined

The output of the J-lens is restricted to single tokens. This is quite a severe limitation, because many of the concepts we care about can't be represented in a human-interpretable way by a single token. The template lens is a J-lens-esque technique for these multi-token concepts.

We start with a list of D multi-token words/phrases $w_1, ..., w_D$. For each $w_i$, we prompt our model to write a large number of diverse passages where $w_i$ is the natural completion, but $w_i$ doesn't appear anywhere in the passage. We run the model over our passages for $w_i$ and collect $\mathbf{h}_\ell$ at the last token of the passage, taking the mean as $\mathbf{\mu}_i(\ell)$. We'll call the mean $\mathbf{h}_\ell$ over all passages and words $\mathbf{\mu}$. 

The template lens is then defined as follows:

  $$\text{TemplateLens}_\ell(\mathbf{x}) = \mathbf{T}_\ell^\top \mathbf{x}$$


  $$\mathbf{T}_\ell = \left[\mathbf{t}_1(\ell)\ \cdots\ \mathbf{t}_D(\ell)\right]$$

  $$\mathbf{t}_i(\ell) = (\mathbf{\Sigma}_\ell + \lambda I)^{-1}(\mathbf{\mu}_i(\ell) - \mathbf{\mu}(\ell))$$

Essentially, we compare how similar $\mathbf{x}$ is to the difference-in-mean-activations for a given concept $\Delta\mathbf{\mu} = \mathbf{\mu}_i - \mathbf{\mu}$. We *whiten*[^whiten] $\mathbf{x}$ and $\mathbf{\mu}$ to account for the fact that some directions have lower covariance than others, so in those directions a larger $\mathbf{x}$ or $\Delta \mathbf{\mu}$ is more significant.

next:
:   [oracle lens](#oracle-lens).

## r lens {#r-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [R-lens: Making J-lens More Faithful on Early Layers](https://www.lesswrong.com/posts/nv8oedrnLXKRzNEL9/r-lens-making-j-lens-more-faithful-on-early-layers#:~:text=Methods%3A%20the%20R%2DLens), `camilablank` *et al.* (2026)

next:
:   [j++ lens](#j-plus-plus-lens) or [s lens ?!](#s-lens).

## chain lens {#chain-lens}

prerequisites:
:   [*the* logit lens](#logit-lens), [j-lens](#j-lens).

further reading:
:   [The Chain Lens \[interim\]](https://www.lesswrong.com/posts/Nr6fksEqqxNpdz6rk/the-chain-lens-interim), Vogel and Douglas (2026)

The chain lens is a straightforward improvement on the J-lens which uses multi-token prediction heads[^mtp] with contrastive decoding[^contrastivedecoding] to elicit multi-token predictions from the J-lens.

$$ \operatorname{ChainLens}_l(\mathbf{h}_{\ell}) = \operatorname{MultiTokenPrediction}(\mathbf{J}_{l+1:L}\mathbf{h}_{\ell})$$



## j++ lens {#j-plus-plus-lens}

prerequisites:
:   [j-lens](#j-lens), [r lens](#r-lens).

further reading:
:   [J++ Lens: Jacobian Filtering Enables More Faithful Workspace Lenses](https://www.lesswrong.com/posts/nc9dHfcB22JdMzGbr/j-lens-jacobian-filtering-enables-more-faithful-workspace-lenses#:~:text=We%20introduce%20the%20J%2B%2B%20Lens%2C%20which%20improves), Ayonrinde and Lindsey (2026)

## oracle lens {#oracle-lens}

prerequisites:
:   [template lens](#template-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/#:~:text=The%20template%20lens%20requires%20its%20vocabulary), Anthropic (2026)

## omnilens {#omnilens}

prerequisites:
:   [tuned lens](#tuned-lens).

further reading:
:   [Interpreting Language Model Hidden States at Scale](https://arxiv.org/abs/2608.10260), Pettyjohn *et al.* (2026)

## coda lens {#coda-lens}

prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Interpreting Inkling 2 Mini](https://www.goodfire.com/research/interpreting-inkling-2-mini#:~:text=Decoding%20loops%3A%20logit%2Dlens%2C%20tuned%2Dlens%2C%20coda%2Dlens), Lee *et al.* (2026)

This is a simple lens, conceptually similar to the logit lens, for looped models with architecture similar to Inkling 2 Mini. 

Inkling 2 Mini's architecture consists of a 6-transformer-layer "prelude", followed by a 12-layer "core" and then a 6-layer "coda". The core is looped 3 times, which means after the first forward pass through the core we take the output and pass it through the core 2 times subsequently.

<figure class="lens-diagram coda-lens-figure">
  <iframe src="../resource/lens-zoo/coda-lens.svg" title="Inkling 2 Mini prelude, core passes, and coda"></iframe>
</figure>

The coda lens simply cuts out some number of passes through the core (much in the same manner as the last few transformer blocks are cut out for the logit lens), and applies the coda to read out the inter-pass state.

This method is useful as a starting point to interpret what computation is being done in subsequent passes, but is quite limited as a workspace lens. Each pass of the core can do significant computation, which would obscure the intermediate states we wish to recover. Inkling 2 Mini's coda has 6 transformer blocks and is therefore capable of significant computation, which is not desirable for a workspace lens. 



## k-lens {#k-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [K-lens](https://x.com/voooooogel/status/2084858861551526002), Vogel (2026), with [attribution and method in the neuron-lens documentation](https://github.com/stdlogits/neuron-lens#lenses-from-the-logit-lens-to-the-r-lens-and-s-lens)

The K-lens is a natural extension of the J-lens. Instead of finding the Jacobian $\frac{\partial \mathbf{h}_L}{\mathbf{h}_{\ell}}$, we find the Jacobian transpose from $\frac{\partial \mathbf{h}_0}{\partial \mathbf{h}_{\ell}}$:

$$\frac{\partial \mathbf{h}_0}{\partial F_{1:l}(\mathbf{h}_0)} \mathbf{W}^{\top}_E = \mathbf{K}^{\top}\mathbf{W}^{\top}_E$$

$\mathbf{K}^\top$ is estimated by first estimating $\mathbf{K}$ in a similar manner to $\mathbf{J}$: we perturb $\mathbf{h}_0$ and observe its average effects on $\mathbf{h}_{\ell}$ across a range of base contexts. We can interpret the output of the K-lens as telling us: comparing a typical residual-stream vector at this layer $\mathbf{v}_l$ to $\mathbf{v}_l + \varepsilon\mathbf{h}_{\ell}$, which input tokens do we need "more" of in the initial embedding to have caused $\mathbf{v}_l + \varepsilon\mathbf{h}_{\ell}$?

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

## $\omega$-J lenses {#omega-j-lenses}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [A Mathematical Theory of the Jacobian Lens](https://arxiv.org/html/2610.31955v1#S1.SS2), Ostrow *et al.* (2026)

## a-lens ?! {#a-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [A-lens (experimental, ours)](https://github.com/moudrkat/brainscope/blob/main/docs/jlens.md#a-lens-experimental-ours), brainscope (2026)

[^workspace]: Psychology term referring to the space of consciously accessible and manipulable concepts -- see [Baars (2002)](https://pubmed.ncbi.nlm.nih.gov/11849615/)

[^affine]: An *affine* transformation of a vector $\mathbf{v}$ to $\mathbf{u}$ is described by a matrix $\mathbf{W}$ and vector $\mathbf{b}$, and computed as $\mathbf{u} = \mathbf{W}\mathbf{v} + \mathbf{b}$

[^inverseunembedding]: $\mathbf{e}_i$ \approx $\mathbf{W}_U\mathbf{v}$. Suppose there exists some "inverse-unembedding" matrix $\mathbf{W}^{-1}_U: \text{ } \mathbf{W}^{-1}_U \mathbf{W}_U \approx \mathbb{I}$ and $\mathbf{W}_U \mathbf{W}^{-1}_U \approx \mathbb{I}$. Then $\mathbf{W}^{-1}_U \mathbf{e}_i  \approx \mathbf{v}$, i.e. the columns of the "inverse-unembedding" matrix are the residual vectors that approximately correspond to each token after unembedding.

[^jspace]: $\mathbf{e}_i \approx \mathbf{W}_U\mathbf{J}\mathbf{v}$. Suppose there exists some inverse-unembedding matrix and inverse-Jacobian matrix $\mathbf{W}^{-1}_U, \mathbf{J}^{-1}: \text{ } \mathbf{J}^{-1}\mathbf{W}^{-1}_U \mathbf{W}_U \mathbf{J} \approx \mathbb{I}$ and $\mathbf{W}_U \mathbf{J} \mathbf{J}^{-1}\mathbf{W}^{-1}_U \approx \mathbb{I}$. Then $\mathbf{J}^{-1}\mathbf{W}^{-1}_U \mathbf{e}_i \approx \mathbf{v}$ i.e. the columns of $\mathbf{J}^{-1}\mathbf{W}^{-1}_U$ are the vectors that, on average, after subsequent transformer layers and unembedding, only increase the probability of a specific given token being output.

[^mtp]: as the name implies, an MTP head allows multiple tokens to be decoded from a single last-layer residual $\mathbf{h}_L$. Introduced by [Gloeckle *et al.*](https://arxiv.org/pdf/2404.19737) (2024)

[^contrastivedecoding]: An interesting technique, but slightly out of scope for this post. Introduced by [Li *et al.*](https://arxiv.org/abs/2210.15097) (2022)

[^whiten]: [en.wikipedia.org/wiki/Whitening_transformation](https://en.wikipedia.org/wiki/Whitening_transformation). $\Sigma_\ell$ is the covariance matrix of $h_\ell$s over all words & all passages. We add $\lambda I$ as a [ridge regularisation](https://en.wikipedia.org/wiki/Ridge_regression) term which prevents directions with very small variance from dominating $t_i(\ell)$.