require 'test/unit'
require 'open3'

class TestCLI < Test::Unit::TestCase
    def setup
        @cli_path = File.join(File.dirname(__FILE__), '..', 'sss.rb')
    end

    def run_cli(*args)
        cmd = ['ruby', @cli_path] + args.compact.map(&:to_s)
        stdout, stderr, status = Open3.capture3(*cmd)
        [stdout, stderr, status.exitstatus]
    end

    def test_help_command
        stdout, stderr, exit_code = run_cli('help')
        assert_equal(0, exit_code)
        assert_match(/SSSA CLI - Shamir's Secret Sharing Algorithm/, stdout)
        assert_match(/Usage:/, stdout)
        assert_match(/create:/, stdout)
        assert_match(/combine:/, stdout)
        assert_match(/validate:/, stdout)
    end

    def test_no_command_shows_help
        stdout, stderr, exit_code = run_cli()
        assert_equal(0, exit_code)
        assert_match(/SSSA CLI - Shamir's Secret Sharing Algorithm/, stdout)
    end

    def test_unknown_command
        stdout, stderr, exit_code = run_cli('invalid')
        assert_equal(1, exit_code)
        assert_match(/Unknown command: invalid/, stdout)
        assert_match(/Usage:/, stdout)
    end

    def test_create_command_success
        stdout, stderr, exit_code = run_cli('create', '3', '5', 'test secret')
        assert_equal(0, exit_code)
        assert_match(/Secret successfully split into 5 shares/, stdout)
        assert_match(/Share 1:/, stdout)
        assert_match(/Share 5:/, stdout)
        
        # Extract shares for validation
        shares = stdout.scan(/Share \d+: (.+)/).flatten
        assert_equal(5, shares.length)
        
        # Each share should be valid base64 and proper length
        shares.each do |share|
            assert_equal(0, share.length % 88, "Share length should be multiple of 88")
            assert_match(/^[A-Za-z0-9+\/_=-]+$/, share, "Share should be valid base64")
        end
    end

    def test_create_command_insufficient_args
        stdout, stderr, exit_code = run_cli('create')
        assert_equal(1, exit_code)
        assert_match(/Error: Not enough arguments/, stdout)
        assert_match(/Usage: ruby sss.rb create/, stdout)
    end

    def test_create_command_invalid_minimum
        stdout, stderr, exit_code = run_cli('create', '0', '5', 'test')
        assert_equal(1, exit_code)
        assert_match(/Error: Invalid share parameters/, stdout)
    end

    def test_create_command_minimum_exceeds_total
        stdout, stderr, exit_code = run_cli('create', '6', '5', 'test')
        assert_equal(1, exit_code)
        assert_match(/Error: Invalid share parameters/, stdout)
    end

    def test_combine_command_success
        # First create shares
        stdout, stderr, exit_code = run_cli('create', '3', '5', 'test secret')
        assert_equal(0, exit_code)
        
        # Extract shares
        shares = stdout.scan(/Share \d+: (.+)/).flatten
        
        # Combine using minimum required shares
        stdout, stderr, exit_code = run_cli('combine', shares[0], shares[1], shares[2])
        assert_equal(0, exit_code)
        assert_match(/Recovered secret: test secret/, stdout)
    end

    def test_combine_command_insufficient_args
        stdout, stderr, exit_code = run_cli('combine')
        assert_equal(1, exit_code)
        assert_match(/Error: Not enough shares provided/, stdout)
        assert_match(/Usage: ruby sss.rb combine/, stdout)
    end

    def test_validate_command_valid_share
        # First create a share
        stdout, stderr, exit_code = run_cli('create', '2', '3', 'test')
        assert_equal(0, exit_code)
        
        share = stdout.scan(/Share 1: (.+)/).flatten.first
        
        # Validate the share
        stdout, stderr, exit_code = run_cli('validate', share)
        assert_equal(0, exit_code)
        assert_match(/Share is valid/, stdout)
    end

    def test_validate_command_invalid_share
        stdout, stderr, exit_code = run_cli('validate', 'invalid_share')
        assert_equal(0, exit_code)
        assert_match(/Share is invalid/, stdout)
    end

    def test_validate_command_insufficient_args
        stdout, stderr, exit_code = run_cli('validate')
        assert_equal(1, exit_code)
        assert_match(/Error: No share provided/, stdout)
        assert_match(/Usage: ruby sss.rb validate/, stdout)
    end

    def test_full_workflow
        secret = 'my secret password'
        
        # Create shares
        stdout, stderr, exit_code = run_cli('create', '3', '5', secret)
        assert_equal(0, exit_code)
        
        shares = stdout.scan(/Share \d+: (.+)/).flatten
        assert_equal(5, shares.length)
        
        # Validate each share
        shares.each do |share|
            stdout, stderr, exit_code = run_cli('validate', share)
            assert_equal(0, exit_code)
            assert_match(/Share is valid/, stdout)
        end
        
        # Combine with minimum shares (3)
        stdout, stderr, exit_code = run_cli('combine', shares[0], shares[2], shares[4])
        assert_equal(0, exit_code)
        assert_match(/Recovered secret: #{secret}/, stdout)
        
        # Should also work with more than minimum
        stdout, stderr, exit_code = run_cli('combine', shares[0], shares[1], shares[2], shares[3])
        assert_equal(0, exit_code)
        assert_match(/Recovered secret: #{secret}/, stdout)
    end

    def test_create_command_empty_secret
        stdout, stderr, exit_code = run_cli('create', '2', '3', '')
        assert_equal(1, exit_code)
        assert_match(/Error: Secret cannot be empty/, stdout)
    end

    def test_edge_cases
        # Special characters in secret
        special_secret = 'test!@#$%^&*()_+-=[]{}|;:,.<>?'
        stdout, stderr, exit_code = run_cli('create', '2', '3', special_secret)
        assert_equal(0, exit_code)
        
        shares = stdout.scan(/Share \d+: (.+)/).flatten
        stdout, stderr, exit_code = run_cli('combine', shares[0], shares[1])
        assert_equal(0, exit_code)
        assert_match(/Recovered secret: #{Regexp.escape(special_secret)}/, stdout)
    end
end