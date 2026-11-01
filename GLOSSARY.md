# Glossary

Domain terms used across the library, the WordPress plugin and the demos.

**Content source**: where content comes from, behind the `ContentSource` contract. WordPress is the first adapter.

**Content change**: a fact about one object that changed in the content source: what happened, the object's type and ID (and its slug). For entries, it also lists the taxonomies their type uses, because publishing or removing an entry changes those terms' counts. A content change does not say which cached results it affects.
_Avoid_: invalidation request, tag list (for the webhook payload).

**Cache tag**: a string attached to a cached result (`post:12`, `type:post`, `term:4`, `menu:10`) so it can be invalidated together with others that share it.

**Identity tag**: the cache tag that names one object: `<type>:<id>` (`post:12`, `page:4`, `attachment:7`, `user:1`, `term:4`, `menu:10`).

**Invalidation contract**: the single module that owns the cache tag vocabulary in both directions: _result tags_ (what a cached result depends on) and _change tags_ (what a content change invalidates). Everything that attaches or invalidates tags goes through it.

**Result tags**: the cache tags derived from a cached result: its own identity tags plus the identity tags of everything it embeds (terms, author, featured image, the entries and terms linked from a menu). Dependencies are always read from the result, never guessed from the change.

**Change tags**: the cache tags a content change invalidates: the changed object's identity tag, plus `type:<type>` for entries and `taxonomy:<name>` for the taxonomies whose counts it affects.
