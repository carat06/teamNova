package com.trustid.config;

import com.trustid.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String authHeader = request.getHeader("Authorization");
        System.err.println("DEBUG: Auth Header: " + authHeader);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            System.err.println("DEBUG: Extracted Token: " + token);
            if (jwtUtil.validateToken(token)) {
                String mobile = jwtUtil.extractMobile(token);
                System.err.println("DEBUG: Validated Token for Mobile: " + mobile);
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        mobile, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                System.err.println("DEBUG: Token Validation FAILED");
            }
        } else {
            System.err.println("DEBUG: No Bearer token found in header");
        }
        filterChain.doFilter(request, response);
    }
}
