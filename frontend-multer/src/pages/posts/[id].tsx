import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../contexts/AuthContext";

interface Author {
  username: string;
}

interface Post {
  id: string;
  content: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
  author?: Author;
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    author?: Author;
  };
  replies?: Post[];
}

export default function PostDetails() {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, token } = useAuth();

  useEffect(() => {
    if (!postId) return;

    async function fetchPost() {
      try {
        const response = await fetch(`http://localhost:3000/posts/${postId}`);
        if (response.ok) {
          const postData = await response.json();
          setPost(postData);
        } else {
          router.push("/");
        }
      } catch (error) {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId, router]);

  async function handleDelete() {
    if (!token) {
      alert("Please login to delete posts");
      return;
    }

    if (confirm("Are you sure you want to delete this post?")) {
      try {
        const response = await fetch(`http://localhost:3000/posts/${postId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          alert("Post deleted successfully");
          router.push("/");
        } else if (response.status === 401) {
          alert("Please login to delete posts");
          router.push("/auth/login");
        } else if (response.status === 403) {
          alert("You can only delete your own posts");
        } else {
          alert("Error deleting post");
        }
      } catch (error) {
        alert("Error deleting post");
      }
    }
  }

  function canModifyPost(): boolean {
    return (
      user && post && post.author && post.author.username === user.username
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!post) {
    return <div>Post not found</div>;
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Post Details</h1>
        <div>
          {canModifyPost() && (
            <a href={`/posts/${post.id}/edit`} className="btn btn-warning me-2">
              Edit
            </a>
          )}
          <a href="/" className="btn btn-secondary">
            Back to Posts
          </a>
        </div>
      </div>

      {post.replyTo && (
        <div className="mb-3 p-3 bg-light border-start border-4 border-secondary">
          <div className="small text-muted mb-2">Replying to:</div>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <strong>{post.replyTo.author?.username || "Anonymous"}</strong>
          </div>
          <div className="small">
            <a
              href={`/posts/${post.replyTo.id}`}
              className="text-dark text-decoration-none"
            >
              {post.replyTo.content}
            </a>
          </div>
        </div>
      )}

      <div className="card">
        {post.imagePath && (
          <img
            src={`${process.env.NEXT_PUBLIC_UPLOAD_URL}/${post.imagePath}`}
            className="card-img-top"
            alt="Post image"
            style={{
              maxWidth: "100%",
              maxHeight: "600px",
              objectFit: "contain",
            }}
          />
        )}
        <div className="card-body">
          <p className="card-text">{post.content}</p>
          <div className="mt-3">
            <small className="text-muted">
              {post.author && (
                <>
                  <strong>Author:</strong> {post.author.username}
                  <br />
                </>
              )}
              <strong>Created:</strong>{" "}
              {new Date(post.createdAt).toLocaleDateString()}
              <br />
              <strong>Updated:</strong>{" "}
              {new Date(post.updatedAt).toLocaleDateString()}
            </small>
          </div>
          <div className="mt-3">
            {user && (
              <a
                href={`/posts/${post.id}/reply`}
                className="btn btn-sm btn-success me-2"
              >
                Reply
              </a>
            )}
          </div>
        </div>
      </div>

      {post.replies && post.replies.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-3">Replies ({post.replies.length})</h4>
          {post.replies.map((reply) => (
            <div key={reply.id} className="card mb-3">
              {reply.imagePath && (
                <img
                  src={`${process.env.NEXT_PUBLIC_UPLOAD_URL}/${reply.imagePath}`}
                  className="card-img-top"
                  alt="Reply image"
                  style={{ maxWidth: "100%", maxHeight: "400px", objectFit: "contain" }}
                />
              )}
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>{reply.author?.username || "Anonymous"}</strong>
                  <small className="text-muted">
                    {new Date(reply.createdAt).toLocaleDateString()}
                  </small>
                </div>
                <p className="card-text">
                  <a
                    href={`/posts/${reply.id}`}
                    className="text-dark text-decoration-none"
                  >
                    {reply.content}
                  </a>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canModifyPost() && (
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
          >
            Delete Post
          </button>
        </div>
      )}
    </>
  );
}
