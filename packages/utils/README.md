# `@discord-player/utils`

Discord Player utilities

## Installation

```sh
$ yarn add @discord-player/utils
```

## Example

### Queue

```js
import { Queue } from "@discord-player/utils";

// initialize queue with last-in-first-out strategy
const lifo = new Queue<number>("LIFO");
// initialize queue with first-in-first-out strategy
const fifo = new Queue<number>("FIFO");

// add some data to the queue
lifo.add([1, 2, 3, 4]);
fifo.add([1, 2, 3, 4]);

// dispatches last inserted item from the queue
console.log(lifo.dispatch()); // 4

// dispatches first inserted item from the queue
console.log(fifo.dispatch()); // 1

console.log(lifo.at(0)); // 3
console.log(fifo.at(0)); // 2
```

### Collection

```ts
import { Collection } from "@discord-player/utils";

// utility data structure based on Map
const store = new Collection<string, number>();

store.set("foo", 1);

console.log(store.get("foo")); // 1
store.delete("foo"); // true
console.log(store.get("foo")); // undefined
store.delete("foo"); // false
```

### Key Mirror

```ts
import { keyMirror } from "@discord-player/utils";

// creates read-only object with same value as the key
const enums = keyMirror([
    "SUNDAY",
    "MONDAY",
    "TUESDAY"
]);

console.log(enums);

/*
{
    "SUNDAY": "SUNDAY",
    "MONDAY": "MONDAY",
    "TUESDAY": "TUESDAY"
}
*/
```