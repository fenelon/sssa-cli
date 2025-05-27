# SSSA CLI Tool

A command-line utility written in Ruby for Shamir's Secret Sharing Algorithm, allowing you to split secrets into shares and recombine them to retrieve the secret.

This tool deliberately avoids external dependencies and ships with the complete sssa-ruby implementation to ensure transparency and safety when handling sensitive data.

<img width="912" alt="image" src="https://github.com/user-attachments/assets/739c55e9-5a7a-442b-8d81-5ae1d3027c92" />

## What is Shamir's Secret Sharing

Shamir's secret sharing (SSS) is an efficient secret sharing algorithm for distributing private information (the "secret") among a group. The secret cannot be revealed unless a minimum number of the group's members act together to pool their knowledge. To achieve this, the secret is mathematically divided into parts (the "shares") from which the secret can be reassembled only when a sufficient number of shares are combined. SSS has the property of information-theoretic security, meaning that even if an attacker steals some shares, it is impossible for the attacker to reconstruct the secret unless they have stolen a sufficient number of shares.

Shamir's secret sharing is used in some applications to share the access keys to a master secret.

Source: <https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing>

## Installation

Clone this repository and ensure you have Ruby installed.

## Usage

### Create Shares
Split a secret into multiple shares:
```bash
ruby sss.rb create <minimum_shares> <total_shares> <secret>
```

Example:
```bash
ruby sss.rb create 3 5 "my secret password"
```
This creates 5 shares where any 3 can be used to recover the original secret.

### Combine Shares
Recover a secret from shares:
```bash
ruby sss.rb combine <share1> <share2> <share3> ...
```

Example:
```bash
ruby sss.rb combine "share1_data" "share2_data" "share3_data"
```

### Validate Shares
Check if a share is valid:
```bash
ruby sss.rb validate <share>
```

### Help
Display usage information:
```bash
ruby sss.rb help
```

### Testing
To run both SSS implementation and CLI interface tests:
```bash
ruby ./tests/all.rb
```

## Authors

Ellin Pino (@fenelon) - Original CLI implementation

## Attribution

This tool is based and includes the SSSA Ruby implementation by Alexander Scheel, Joel May, and Matthew Burket: <https://github.com/SSSaaS/sssa-ruby>

Licensed under the MIT License.
