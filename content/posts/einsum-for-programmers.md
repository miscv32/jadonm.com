---
title: Einsum for ~~dummies~~ programmers
date: 2026-10-17
# updated: 2026-10-17
---

## Assumptions

You are familiar with programming in a procedural language (for loops, if statements, multi-dimensional array indexing). You know what scalars, matrices and tensors are. You are familiar with matrix multiplication. You know what a set is. You know what the trace of a matrix is.

## What the hell is an "einsum"??

Einsum is a ~~notation~~ DSL for expressing tensor operations. It is supported in popular (as of October 2026) Python libraries NumPy, PyTorch and JAX, with an API that looks like:

```py
einsum("ij,jk->ik", a, b)
```

## Specifying axes

Each axis of each tensor is referred to by a single English-alphabetic letter (the "label") which may or may not be unique.

## What's between the commas?

On the left hand side of the arrow, there are a number of alphabetic strings ("subscript strings") separated by commas. You can think of the subscript strings as selecting *sets* of indices in the tensor, whereas an index like `M[1][2][3]` selects a single scalar element from the tensor. The rules are that there must be as many subscript strings as there are input tensors, and that each subscript string must have as many labels as the corresponding tensor has dimensions.

One way to understand subscript strings is by imagining writing `for`-loops over all the tensor dimensions in the usual manner. 

```py
ijk = set()
iii = set()
for i in range(length_of_axis_0):
    for j in range(length_of_axis_1):
        for k in range(length_of_axis_2):
            ijk.add((i,j,k))
            iii.add((i,i,i))
```

This brings up an important problem: not all subscript strings are valid for all tensors. It depends on the relative sizes of the tensor dimensions. The subscript string `ii` is invalid for non-square matrices, do you see why?

## The comma

Let's consider `einsum("ij,jk->ik", a, b)` as an illustration of what the comma does:

```py
for i in range(length_of_a_axis_0):
    for j1 in range(length_of_a_axis_1):
        for j2 in range(length_of_b_axis_0):
            for k in range(length_of_b_axis_1):
                if j1 == j2:
                    j = j1 # = j2
                    T[i][j][k] = a[i][j] * b[j][k] # T is a temporary tensor, with axes given by all the unique labels from all of the subscript strings.

```

Some important considerations:

- Disallow `length_of_a_axis_1 != length_of_b_axis_0`. Like we saw before, if we have two axes (in the same tensor, or in separate tensors) labelled with the same letter, they should have the same length.

As another example, let's consider `einsum("ii,ii->", a, b)` (don't worry about the lack of letters to the right hand side of the arrow, we'll get to that)

```py
for i1 in range(length_of_a_axis_0):
    for i2 in range(length_of_a_axis_1):
        for i3 in range(length_of_b_axis_0):
            for i4 in range(length_of_b_axis_1):
                if i1 == i2 == i3 == i4:
                    i = i1 # = i2 = i3 = i4
                    T[i] = a[i][i] * b[i][i]
```

Alright, one more example: `einsum("ii,ij->", a, b)`

```py
for i1 in range(length_of_a_axis_0):
    for i2 in range(length_of_a_axis_1):
        for i3 in range(length_of_b_axis_0):
            for j in range(length_of_b_axis_1):
                if i1 == i2 == i3:
                    i = i1 # = i2 = i3
                    T[i][j] = a[i][i] * b[i][j]
```

In general, the idea is to loop over the labelled axes, and where equally-labeled axes take the same index, multiply and write to the temporary tensor.

All the examples here have been for single-comma left-hand-side expressions. It should be fairly straightforward for you to extend this to multiple commas. You can try writing the `for`-loops for `einsum("ijk,jki,kij->", a, b, c)` as an exercise if you're a sweaty little try-hard, or just keep reading if you're a lazy bum. 

## Right of the arrow

The subscript string to the right of the arrow tells you which axes to retain and in which order. The axes that are not retained should be summed over, such that the output has the shape implied. Also, you can't introduce new labels in the right-hand subscript string or use the same label more than once.

Consider `einsum("ijk,jjk->kj",a,b)`.

The label `i` is omitted from the string to the right, which means we need to sum over `i`. The ordering of the labels tells you the ordering of axes in the result tensor, R. 

```py
for i in range(length_of_a_axis_0):
    for j1 in range(length_of_a_axis_1):
        for k1 in range(length_of_a_axis_2):
            for j2 in range(length_of_b_axis_0):
                for j3 in range(length_of_b_axis_1):
                    for k2 in range(length_of_b_axis_2):
                        if j1 == j2 == j3 and k1 == k2:
                            j = j1 # = j2 = j3
                            k = k1 # = k2
                            T[i][j][k] = a[i][j][k] * b[j][j][k]

for i in range(len(T)):
    for j in range(len(T[0])):
        for k in range(len(T[0][0])):
            R[k][j] += T[i][j][k]
```

The try-hards reading this will note that it is not strictly necessary to introduce `T` at all, so we can simplify this to one set of nested `for`-loops like so:

```py
for i in range(length_of_a_axis_0):
    for j1 in range(length_of_a_axis_1):
        for k1 in range(length_of_a_axis_2):
            for j2 in range(length_of_b_axis_0):
                for j3 in range(length_of_b_axis_1):
                    for k2 in range(length_of_b_axis_2):
                        if j1 == j2 == j3 and k1 == k2:
                            j = j1 # = j2 = j3
                            k = k1 # = k2
                            R[k][j] += a[i][j][k] * b[j][j][k]
```

Of course, we don't actually need so many `for`-loops here either (nor did we in any of the previous examples with repeated labels), so we can go further:

```py
for i in range(length_of_a_axis_0):
    for j in range(length_of_a_axis_1):
        for k in range(length_of_a_axis_2):
            R[k][j] += a[i][j][k] * b[j][j][k]
```

Where the right-hand subscript string is empty, we sum over all axes of `T` to produce a scalar. Therefore, as an example, `einsum("ii->", a)` = $Tr(A)$.

## Nota bene

The einsum implementations in NumPy, PyTorch and JAX support [broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html), and working with tensors of arbitrary dimension via the ellipsis notation, which I don't discuss in this post. 


## Links

[Aladdin Persson - Einsum Is All You Need: NumPy, PyTorch and TensorFlow](https://www.youtube.com/watch?v=pkVwUVEHmfI) - introduced me to `einsum`.

[Olexa Bilaniuk - Einstein Summation in Numpy](https://obilaniu6266h16.wordpress.com/2016/02/04/einstein-summation-in-numpy/) - explains broadly the same content as this post, has diagrams which I found confusing but you may find helpful.

[Tim Rocktäschel - Einsum is All You Need -- Einstein Summation in Deep Learning](https://rockt.ai/2018/04/30/einsum) - lots of examples of common operations expressed in einsum notation.

## Acknowledgements

Thanks to [Aarav Bhatt](https://aaravbhatt.dev) for proofreading and providing feedback :)

All the words and code samples in this post were written by me. However, I used GPT-5.6 Sol as a critic while writing the post, mostly to check factual correctness, and also for some initial learning. You can read the chat log [here](https://chatgpt.com/share/6ab03fe9-6ce0-83eb-a188-5a5a0659fbf6).