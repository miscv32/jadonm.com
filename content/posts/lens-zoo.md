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


## transformer architecture recap
further reading:
:   [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html), Anthropic (2021)

<figure class="lens-diagram architecture-recap-figure">
  <iframe src="../resource/lens-zoo/residual-stream.svg?view=recap" title="Transformer architecture diagram"></iframe>
</figure>

- A transformer takes a sequence of tokens as input.
- Each token is a one-hot vector of shape $|V| \times 1$, i.e. the token that we assign index $i$ is represented by the vector where $v_i = 1$, $v_j |_{j \ne i} = 0$
- First, we apply the "embedding matrix" which "down-projects" the $|V| \times 1$ token to a $d_{model} \times 1$ residual-stream vector
    - $d_{model}$ is called the "hidden dimension"

- Transformer blocks (layers), at a high level, read from and write to the residual stream based on the earlier tokens in the sequence and the residual stream as seen at their input.
    - You can think of attention heads as responsible for looking back at earlier tokens, and writing relevant information from those tokens into the residual stream, and the MLPs as responsible for doing various computations and transformations with the information in the residual stream.

- Finally, the residual-stream vector is "up-projected" from $d_{model} \times 1$ to $|V| \times 1$ by the unembedding matrix. The resulting vector can be interpreted as a log-probability distribution over tokens, given the model parameters and sequence of already-seen tokens.



## *the* logit lens {#logit-lens}
prerequisites:
:   [what is a lens?](#what-is-a-lens), [transformer architecture recap](#transformer-architecture-recap).

further reading:
:   [interpreting GPT: the logit lens](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens), `nostalgebraist` (2020)

The logit lens is simple to implement; we apply the unembedding matrix at an intermediate point in the residual stream. An equivalent way of thinking about this is that we "cut out" further transformer blocks past some point in the residual stream (see interactive figure). 

<p class="residual-stream-toggle lens-diagram-switch" role="group" aria-label="Diagram view">
  <button type="button" aria-pressed="true" aria-controls="residual-stream-figure">Full transformer</button>
  <span aria-hidden="true">·</span>
  <button type="button" aria-pressed="false" aria-controls="residual-stream-figure" data-lens-view>Logit lens</button>
</p>

<figure class="lens-diagram logit-lens-figure">
  <iframe id="residual-stream-figure" src="../resource/lens-zoo/residual-stream.svg" title="Transformer and logit lens diagram"></iframe>
</figure>

<script src="../resource/lens-zoo/residual-stream.js" defer></script>

Why does this work at all?

If a layer "wants" to push the next-token prediction towards a specific token $\mathbf{e}_i$[^ei], the best way for it to transmit this information is by writing the vector $\mathbf{v}$ to the residual stream, where $\mathbf{e}_i$ =  $\mathbf{W}_U\mathbf{v}$[^wu].

On the other hand, if a layer has information that it intends for a later layer to read as part of a circuit, there's no reason that the way it writes this information to the residual stream should have any relation to the unembedding matrix, since the later layer(s) can easily transform these directions arbitrarily. 

As you'd expect, the output of the logit lens is not very interpretable when applied on the lower layers, since much of the residual stream content is written to transmit information to later layers for further computation. We'll call the tendency for average token-concept representations at intermediate layers to drift from the inverse-unembedding basis[^inverseunembedding], *representational drift*.

Another important limitation of the logit lens is that it doesn't target the model's *global workspace* well.

The global workspace is (handwavingly) the space of concepts which a model has "conscious" access to, i.e. that it can accurately report on and manipulate at will. For instance, when answering a dastardly difficult multi-step reasoning problem like "What colour are the buses in the city containing Buckingham Palace?", we might expect to observe concepts relating to the words "bus", "city", "Buckingham Palace", "London", and "red" in the workspace.

The logit lens at a particular position in the residual stream mostly surfaces the tokens that the preceding layer wants to push the next-token prediction towards. For a question like "What colour is $X$?", it's quite clear that "London" is an unlikely answer, so a model might avoid pushing the next-token prediction towards "London", even though it's likely the model represents a concept for "London" internally as part of an intermediate reasoning step.

next:
:   [tuned lens](#tuned-lens), [j-lens](#j-lens), [future lens](#future-lens), [chain lens](#chain-lens), or [coda lens](#coda-lens).

## tuned lens {#tuned-lens}
prerequisites:
:   [*the* logit lens](#logit-lens).

further reading:
:   [Eliciting Latent Predictions from Transformers with the Tuned Lens](https://arxiv.org/pdf/2303.08112), Belrose *et al.* (2023)

We saw earlier that the logit lens fails to account for *representational drift*, that is, the same token-concepts being represented differently at different points in the residual stream. To account for this, the tuned lens trains an affine[^affine] "translator" to approximate the behaviour of the transformer blocks after some point in the residual stream. 

<p class="residual-stream-toggle lens-diagram-switch" role="group" aria-label="Diagram view">
  <button type="button" aria-pressed="false" aria-controls="tuned-lens-figure">Full transformer</button>
  <span aria-hidden="true">·</span>
  <button type="button" aria-pressed="true" aria-controls="tuned-lens-figure" data-lens-view>Tuned lens</button>
</p>

<figure class="lens-diagram tuned-lens-figure">
  <iframe id="tuned-lens-figure" src="../resource/lens-zoo/residual-stream.svg?lens=tuned" title="Transformer and tuned lens diagram"></iframe>

</figure>

As long as the representational drift is well approximated by an affine transformation, the tuned lens should correct for this and provide a more interpretable readout, especially at earlier layers where the drift is worse.

As long as the computation done by the transformer layers after some point is *not* well approximated by an affine transformation, the translator that replaces them should be incapable of learning to "shortcut" intermediate activations to last-layer activations. If our translator copies the computation done by the transformer layers it replaces too well, it becomes useless, since we lose access to the intermediate steps we're interested in.

Of course, neither of these assumptions are entirely true. Tuned lenses tend to produce more coherent outputs at earlier layers compared to logit lenses, but in practice they sometimes have the capacity to approximate the remaining transformer layers fairly well, skipping over intermediate token-concept representations that other lenses can recover.

Unfortunately, like its [younger sibling](#logit-lens), the tuned lens still doesn't target the model's workspace well.

The aim of a tuned lens is to [Elicit Latent Predictions](https://arxiv.org/pdf/2303.08112), and therefore it shouldn't be surprising that tuned lens output distribution at later layers roughly monotonically converges towards the model's actual output distribution. We trained our "translators" to minimise prediction error, and with each successive layer we give them input with greater *mutual information* with the output they're trying to predict.

However, we might expect the workspace token distributions to occasionally diverge from the final next-token prediction when the model does multi-step reasoning. This suggests that the tuned lens doesn't reliably target the model's workspace.

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

What does this mean?

Intuition

Take the transformer blocks + unembedding matrix after some point as a black box. We start with some initial activations (context), and see what outputs they produce. We then perturb these initial activations, and look at the *change* in the output token distribution given this perturbation. We average this change across many different contexts, to get rid of effects of perturbation that only appear in some context but not in others. If we try enough varied contexts, we should be able to build a model of how perturbing an activation in some direction tends to shift the distribution.

We care about how a direction tends to shift the distribution independent of context because in some sense this should be its "meaning", assuming that the model constructs higher level/compound concepts by superposing directions for different features (see understanding LRH)

~~~{=html}
<div class="j-lens-toolbar">
  <p class="residual-stream-toggle" data-j-lens role="group" aria-label="J-lens diagram steps" hidden>
    <button type="button" data-slide="average" aria-pressed="true" aria-controls="j-lens-figure">Average effects</button>
    <span aria-hidden="true">·</span>
    <button type="button" data-slide="readout" aria-pressed="false" aria-controls="j-lens-figure">Read out</button>
  </p>
  <div class="j-lens-steps" role="group" aria-label="Average effects slideshow" hidden>
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

<script src="../resource/lens-zoo/j-lens.js" defer></script>

Mathematical derivation

TODO work out nice way of deriving this mathematically. Also check if it exists in global workspace paper

next:
:   [template lens](#template-lens), [r lens](#r-lens), [chain lens](#chain-lens), [j++ lens](#j-plus-plus-lens), [k lens ?!](#k-lens), [$\omega$-J lenses](#omega-j-lenses), or [a-lens ?!](#a-lens).

## future lens {#future-lens}
prerequisites:
:   [*the* logit lens](#logit-lens), [tuned lens](#tuned-lens).

further reading:
:   [Future Lens: Anticipating Subsequent Tokens from a Single Hidden State](https://aclanthology.org/2023.conll-1.37.pdf), Pal *et al.* (2023)

TODO determine whether tuned lens should actually be prereq. I'm leaning no, they are both learning-based and future lens paper cites tuned lens but the method is different, future lens doesn't use affine translator at all.

This is a pretty creative and cool one.

Intuition

We take some intermediate layer activations from a model, and record the subsequent predicted tokens that correspond to each activation. "real context"

Then, we might hope that we can take this intermediate layer activation and transplant it into a different context, and steer the model to say the same thing as in the original context

in practice though the transformer blocks after the injection point attend to prior tokens in the prompt, so this doesnt work that well.

We can optimise a "soft prompt" / soft context so that the model predicts the "real continuations" well over many different injected activations. The idea here is that the soft prompt will be optimised to only contain information which helps generalised prediction capability e.g. "output gramatically correct text" and therefore the output on the soft prompt + unseen activation is only a function of the "meaning" of the unseen activation. On decoding further tokens we feed back in the soft prompt + first decoded token but re-inject the hidden state.

- TODO is this workspace-like? my feeling is No
- TODO i think this is the first example of multi token lens? verify

- problem: maybe transformer blocks memorise some info that hidden state elicits but is not actually present in the hidden state itself

## template lens {#template-lens}
prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [Verbalizable Representations Form a Global Workspace in Language Models](https://transformer-circuits.pub/2026/workspace/), Anthropic (2026)

Introduced in the same paper as the J-lens, the template lens is

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
:   [The Chain Lens \[interim\]](https://www.lesswrong.com/posts/Nr6fksEqqxNpdz6rk/the-chain-lens-interim#:~:text=The%20core%20idea%20is%20that%20we%20start%20with%20the%20J%2Dlens), Vogel and Douglas (2026)

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

TODO cleanup
This is a pretty simple lens, conceptually similar to the logit lens. In some looped LLMs like inkling 2, there is a prelude -> n loops of k blocks each -> coda (TODO diagram). We just "cut out" the last few loops in the same manner as the last few transformer blocks are cut out for the logit lens, and apply the coda to read out the inter-layer state.

## k lens ?! {#k-lens}

prerequisites:
:   [j-lens](#j-lens).

further reading:
:   [K-lens](https://x.com/voooooogel/status/2084858861551526002), Vogel (2026), with [attribution and method in the neuron-lens documentation](https://github.com/stdlogits/neuron-lens#lenses-from-the-logit-lens-to-the-r-lens-and-s-lens)

next:
:   [s lens ?!](#s-lens).

## s lens ?! {#s-lens}

prerequisites:
:   [r lens](#r-lens), [k lens ?!](#k-lens).

further reading:
:   [neuron-lens](https://github.com/stdlogits/neuron-lens#lenses-from-the-logit-lens-to-the-r-lens-and-s-lens), `_a9lim` and `treetowntree` (2026)

S-lens is to [R-lens](#r-lens) as [K-lens](#k-lens) is to [J-lens](#j-lens).

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
[^inverseunembedding]: $\mathbf{e}_i$ = $\mathbf{W_U}\mathbf{v}$. Suppose there exists some "inverse-unembedding" matrix $\mathbf{W}'_U: \text{ } \mathbf{W}'_U \mathbf{W}_U = \mathbb{I}$. Then $\mathbf{W}'_u \mathbf{e}_i = \mathbf{v}$, i.e. the columns of the "inverse-unembedding" matrix are the vectors that most push the output toward each token.
[^ei]: $\mathbf{e}_i$ is the vector with i'th component 1 and all other components 0
[^wu]: $\mathbf{W}_U$ is the [unembedding matrix](#transformer-architecture-recap)