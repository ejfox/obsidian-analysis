# Database Design Principles

## ACID Properties
Databases should maintain:
- **Atomicity**: Transactions are all-or-nothing
- **Consistency**: Data integrity is preserved  
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes persist

## Normalization
Reducing data redundancy through normal forms:

1. **First Normal Form (1NF)**: Atomic values only
2. **Second Normal Form (2NF)**: No partial dependencies
3. **Third Normal Form (3NF)**: No transitive dependencies

## Indexing Strategy
Proper indexing dramatically improves query performance. Consider:
- Primary key indexes (automatic)
- Foreign key indexes for joins
- Composite indexes for multi-column queries
- Partial indexes for filtered queries

Vector databases like sqlite-vec add new considerations. How do we index high-dimensional vectors efficiently?

The key is balancing search speed with storage overhead. Different use cases require different approaches!