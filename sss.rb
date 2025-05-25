#!/usr/bin/env ruby

require_relative 'lib/sssa.rb'

def print_help
  puts "SSSA CLI - Shamir's Secret Sharing Algorithm"
  puts "Usage:"
  puts "  create: Split a secret into shares"
  puts "    ruby sss.rb create <minimum_shares> <total_shares> <secret>"
  puts "    Example: ruby sss.rb create 3 5 'my secret password'"
  puts ""
  puts "  combine: Combine shares to recover a secret"
  puts "    ruby sss.rb combine <share1> <share2> ..."
  puts "    Example: ruby sss.rb combine 'share1' 'share2' 'share3'"
  puts ""
  puts "  validate: Check if a share is valid"
  puts "    ruby sss.rb validate <share>"
  puts ""
  puts "  help: Show this help message"
  puts "    ruby sss.rb help"
end

command = ARGV[0]

case command
when "create"
  if ARGV.length < 4
    puts "Error: Not enough arguments for 'create' command."
    puts "Usage: ruby sss.rb create <minimum_shares> <total_shares> <secret>"
    exit 1
  end
  
  minimum = ARGV[1].to_i
  total = ARGV[2].to_i
  secret = ARGV[3]

  if minimum <= 0 || total <= 0 || minimum > total
    puts "Error: Invalid share parameters. Minimum must be greater than 0 and not exceed total."
    exit 1
  end

  if secret.nil? || secret.empty?
    puts "Error: Secret cannot be empty."
    exit 1
  end

  begin
    shares = SSSA.create(minimum, total, secret)
    puts "Secret successfully split into #{total} shares (minimum #{minimum} needed to recover):"
    shares.each_with_index do |share, index|
      puts "Share #{index + 1}: #{share}"
    end
  rescue => e
    puts "Error creating shares: #{e.message}"
    exit 1
  end

when "combine"
  if ARGV.length < 2
    puts "Error: Not enough shares provided for 'combine' command."
    puts "Usage: ruby sss.rb combine <share1> <share2> ..."
    exit 1
  end

  shares = ARGV[1..-1]
  
  begin
    recovered_secret = SSSA.combine(shares)
    puts "Recovered secret: #{recovered_secret}"
  rescue => e
    puts "Error combining shares: #{e.message}"
    puts "Make sure you have provided enough valid shares to recover the secret."
    exit 1
  end

when "validate"
  if ARGV.length < 2
    puts "Error: No share provided for 'validate' command."
    puts "Usage: ruby sss.rb validate <share>"
    exit 1
  end

  share = ARGV[1]
  
  if SSSA.isValidShare?(share)
    puts "Share is valid."
  else
    puts "Share is invalid."
  end

when "help", nil
  print_help

else
  puts "Unknown command: #{command}"
  print_help
  exit 1
end